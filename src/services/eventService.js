import Event from '../models/Event.js';
import * as aiService from './aiService.js';
import { resolvePreferredModel } from './settingsService.js';
import { getAsset } from './mediaService.js';
import mongoose from '../lib/db.js';
import { EVENT_STATUS, LANGUAGE_CODES } from '../config/constants.js';
import { sanitizeHtml, stripHtml } from '../lib/sanitize.js';
import {
  mapGet,
  applySupportedEventTranslations,
  applyEventTranslations,
} from '../lib/i18n.js';
import { resolveTenantLanguages } from '../lib/tenantLanguages.js';

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  upcoming: { startAt: 1 },
  alphabetical: { createdAt: -1 }, // refined in-memory below by title
  updated: { updatedAt: -1 },
};

function buildTranslationsMap(input = {}, languageCodes = LANGUAGE_CODES) {
  const map = {};
  for (const code of languageCodes) {
    const t = input[code];
    if (!t) continue;
    const title = (t.title || '').trim();
    const descriptionHtml = sanitizeHtml(t.descriptionHtml || '');
    if (title || descriptionHtml) {
      map[code] = { title, descriptionHtml };
    }
  }
  return map;
}

// Build a Mongo query from filter params. `scopeUserId` restricts to one creator.
export function buildQuery(tenantId, filters = {}, scopeUserId = null, supportedLanguages = LANGUAGE_CODES) {
  const query = { tenantId };
  if (scopeUserId) query.createdBy = scopeUserId;
  if (filters.status) query.status = filters.status;
  if (filters.category) query.categoryIds = filters.category;
  if (filters.audience) query.audienceIds = filters.audience;
  if (filters.character) query.eventCharacterIds = filters.character;
  if (filters.creator) query.createdBy = filters.creator;
  if (filters.price === 'free') query['pricing.isFree'] = true;
  if (filters.price === 'paid') query['pricing.isFree'] = false;

  if (filters.from || filters.to) {
    query.startAt = {};
    if (filters.from) query.startAt.$gte = new Date(filters.from);
    if (filters.to) query.startAt.$lte = new Date(`${filters.to}T23:59:59`);
  }

  if (filters.q) {
    const rx = new RegExp(escapeRegex(filters.q), 'i');
    const orConds = [];
    for (const code of supportedLanguages) {
      orConds.push({ [`translations.${code}.title`]: rx });
    }
    query.$or = orConds;
  }
  return query;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listEvents(
  tenantId,
  { filters = {}, sort = 'newest', scopeUserId = null, page = 1, limit = 20, tenantSettings = null } = {},
) {
  const { supportedLanguages } = tenantSettings
    ? resolveTenantLanguages(tenantSettings)
    : { supportedLanguages: LANGUAGE_CODES };
  const query = buildQuery(tenantId, filters, scopeUserId, supportedLanguages);
  const sortSpec = SORTS[sort] || SORTS.newest;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Event.find(query)
      .sort(sortSpec)
      .skip(skip)
      .limit(limit)
      .populate('categoryIds', 'name color')
      .populate('audienceIds', 'name')
      .populate('eventCharacterIds', 'name')
      .populate('createdBy', 'name email')
      .lean(),
    Event.countDocuments(query),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getEvent(tenantId, id, scopeUserId = null) {
  const query = { _id: id, tenantId };
  if (scopeUserId) query.createdBy = scopeUserId;
  return Event.findOne(query)
    .populate('categoryIds', 'name color')
    .populate('audienceIds', 'name')
    .populate('eventCharacterIds', 'name');
}

function parseDateTime(date, time, allDay) {
  if (!date) return null;
  if (allDay || !time) return new Date(`${date}T00:00:00`);
  return new Date(`${date}T${time}`);
}

function toArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val.filter(Boolean) : [val].filter(Boolean);
}

function normalizeObjectId(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (!str || str === 'undefined' || str === 'null') return null;
  if (!mongoose.Types.ObjectId.isValid(str)) return null;
  return str;
}

function normalizeObjectIdArray(val) {
  return toArray(val).map(normalizeObjectId).filter(Boolean);
}

async function resolveCoverMediaId(tenantId, rawId, scopeUserId) {
  const id = normalizeObjectId(rawId);
  if (!id) return null;
  const asset = await getAsset(tenantId, id, scopeUserId);
  if (!asset) {
    throw new Error(scopeUserId ? 'Cover image not found or access denied.' : 'Cover image not found.');
  }
  return id;
}

export function normalizeInput(body, supportedLanguages = LANGUAGE_CODES) {
  const allDay = body.allDay === 'on' || body.allDay === true;
  return {
    translations: buildTranslationsMap(body.translations, supportedLanguages),
    startAt: parseDateTime(body.startDate, body.startTime, allDay),
    endAt: body.endDate ? parseDateTime(body.endDate, body.endTime, allDay) : null,
    allDay,
    categoryIds: normalizeObjectIdArray(body.categoryIds),
    audienceIds: normalizeObjectIdArray(body.audienceIds),
    eventCharacterIds: normalizeObjectIdArray(body.eventCharacterIds),
    pricing: {
      isFree: body.isFree === 'on' || body.isFree === true || body.pricingType === 'free',
      price: Number(body.price) || 0,
      currency: body.currency || 'ILS',
    },
    coverMediaId: normalizeObjectId(body.coverMediaId),
    galleryMediaIds: normalizeObjectIdArray(body.galleryMediaIds),
  };
}

export async function autoTranslateMissing(event, tenantSettings, tenantId) {
  const { supportedLanguages, defaultLanguage, autoTranslateOnSave } = resolveTenantLanguages(tenantSettings);
  if (!autoTranslateOnSave) return event;
  if (!defaultLanguage) return event;

  const src = mapGet(event.translations, defaultLanguage);
  if (!src?.title) return event;

  const missing = missingLanguages(event, supportedLanguages).filter((code) => code !== defaultLanguage);
  if (!missing.length) return event;

  try {
    const model = await resolvePreferredModel(tenantId, tenantSettings);
    const results = await aiService.translateEvent({
      event,
      sourceLang: defaultLanguage,
      targetLangs: missing,
      model,
      tenantId,
    });
    applyEventTranslations(event, results);
    await event.save();
  } catch {
    // Best-effort; do not block saves when OpenAI is unavailable.
  }
  return event;
}

/** Fill missing translations for all tenant events (optionally scoped to one creator). */
export async function fillMissingEventTranslations(tenantId, tenantSettings, scopeUserId = null) {
  const { supportedLanguages } = resolveTenantLanguages(tenantSettings);
  const query = { tenantId };
  if (scopeUserId) query.createdBy = scopeUserId;

  const events = await Event.find(query);
  let updated = 0;

  let model;
  try {
    model = await resolvePreferredModel(tenantId, tenantSettings);
  } catch {
    return { updated: 0 };
  }

  for (const event of events) {
    const sourceLang = supportedLanguages.find((code) => {
      const tr = mapGet(event.translations, code);
      return tr?.title;
    });
    if (!sourceLang) continue;

    const missing = missingLanguages(event, supportedLanguages).filter((code) => code !== sourceLang);
    if (!missing.length) continue;

    try {
      const results = await aiService.translateEvent({
        event,
        sourceLang,
        targetLangs: missing,
        model,
        tenantId,
      });
      applyEventTranslations(event, results);
      await event.save();
      updated++;
    } catch {
      // Best-effort per event; continue with the rest.
    }
  }

  return { updated };
}

export async function createEvent(
  tenantId,
  userId,
  body,
  tenantSettings,
  scopeUserId = null,
) {
  const { supportedLanguages } = resolveTenantLanguages(tenantSettings);
  const data = normalizeInput(body, supportedLanguages);
  if (!data.startAt) throw new Error('Start date is required');
  data.coverMediaId = await resolveCoverMediaId(tenantId, body.coverMediaId, scopeUserId);
  const { translations, ...rest } = data;
  const event = await Event.create({
    ...rest,
    tenantId,
    createdBy: userId,
    lastModifiedBy: userId,
    status: EVENT_STATUS.DRAFT,
  });
  applyEventTranslations(event, translations);
  await event.save();
  await autoTranslateMissing(event, tenantSettings, tenantId);
  return event;
}

export async function updateEvent(
  tenantId,
  id,
  userId,
  body,
  scopeUserId = null,
  tenantSettings = null,
) {
  const { supportedLanguages } = resolveTenantLanguages(tenantSettings);
  const event = await getEvent(tenantId, id, scopeUserId);
  if (!event) return null;
  const data = normalizeInput(body, supportedLanguages);
  if (!data.startAt) throw new Error('Start date is required');
  data.coverMediaId = await resolveCoverMediaId(tenantId, body.coverMediaId, scopeUserId);
  applySupportedEventTranslations(event, data.translations, supportedLanguages);
  const { translations, ...rest } = data;
  Object.assign(event, rest, { lastModifiedBy: userId });
  await event.save();
  await autoTranslateMissing(event, tenantSettings, tenantId);
  return event;
}

export async function setStatus(tenantId, id, status, scopeUserId = null) {
  const event = await getEvent(tenantId, id, scopeUserId);
  if (!event) return null;
  event.status = status;
  if (status === EVENT_STATUS.PUBLISHED && !event.publishedAt) {
    event.publishedAt = new Date();
  }
  await event.save();
  return event;
}

export async function deleteEvent(tenantId, id, scopeUserId = null) {
  const query = { _id: id, tenantId };
  if (scopeUserId) query.createdBy = scopeUserId;
  return Event.deleteOne(query);
}

// Fraction of supported languages that have a title (0..1).
export function translationCompleteness(event, supportedLanguages) {
  let filled = 0;
  for (const code of supportedLanguages) {
    const tr = mapGet(event.translations, code);
    if (tr && tr.title) filled += 1;
  }
  return supportedLanguages.length ? filled / supportedLanguages.length : 0;
}

export function missingLanguages(event, supportedLanguages) {
  return supportedLanguages.filter((code) => {
    const tr = mapGet(event.translations, code);
    return !(tr && tr.title);
  });
}

export { buildTranslationsMap };

export { stripHtml };
