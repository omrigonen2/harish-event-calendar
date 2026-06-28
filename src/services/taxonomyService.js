import Category from '../models/Category.js';
import Audience from '../models/Audience.js';
import EventCharacter from '../models/EventCharacter.js';
import Event from '../models/Event.js';
import * as aiService from './aiService.js';
import { resolvePreferredModel } from './settingsService.js';
import { resolveTenantLanguages } from '../lib/tenantLanguages.js';

// Shared helpers for the two simple per-tenant taxonomies (categories, audiences).

const CATEGORY_CONTEXT =
  'The text is the name of a category in a public municipal events calendar (e.g. Culture, Sports, Music). Keep it a short, natural category label.';
const AUDIENCE_CONTEXT =
  'The text is the name of a target audience group in a public municipal events calendar (e.g. Families, Adults, Children). Keep it a short, natural audience label.';
const EVENT_CHARACTER_CONTEXT =
  'The text is the name of an event character/type in a public municipal events calendar in Israel (e.g. General, Torah-based, Haredi). Keep it a short, natural label.';

/**
 * Fill in missing supported-language names by translating from the tenant
 * default language (or the first provided name) with domain context.
 * Best-effort: returns the original map unchanged if AI is unavailable or
 * auto-translate is disabled for the tenant.
 */
function contextFor(kind) {
  if (kind === 'audience') return AUDIENCE_CONTEXT;
  if (kind === 'eventCharacter') return EVENT_CHARACTER_CONTEXT;
  return CATEGORY_CONTEXT;
}

/**
 * Translate a single short label from a source language into every other
 * supported language, using the appropriate taxonomy context. Returns a map
 * of { lang: translatedText } for the target languages only.
 */
export async function translateTaxonomyLabel(
  tenantId,
  tenantSettings,
  { text, sourceLang, kind, targetLangs: requestedTargets },
) {
  const value = (text || '').trim();
  if (!value) return {};
  const { supportedLanguages, defaultLanguage } = resolveTenantLanguages(tenantSettings);
  const source =
    sourceLang && supportedLanguages.includes(sourceLang) ? sourceLang : defaultLanguage;
  let targetLangs = supportedLanguages.filter((code) => code !== source);
  if (Array.isArray(requestedTargets) && requestedTargets.length) {
    const allowed = new Set(targetLangs);
    targetLangs = requestedTargets.filter((code) => allowed.has(code));
  }
  if (!targetLangs.length) return {};
  const model = await resolvePreferredModel(tenantId, tenantSettings);
  return aiService.translateText({
    text: value,
    sourceLang: source,
    targetLangs,
    model,
    tenantId,
    context: contextFor(kind),
  });
}

async function autoTranslateName(nameMap = {}, { tenantId, tenantSettings, context }) {
  const merged = { ...nameMap };
  if (!tenantSettings) return merged;

  const { supportedLanguages, defaultLanguage, autoTranslateOnSave } =
    resolveTenantLanguages(tenantSettings);
  if (!autoTranslateOnSave) return merged;

  const sourceLang = merged[defaultLanguage]
    ? defaultLanguage
    : Object.keys(merged).find((k) => merged[k]);
  if (!sourceLang || !merged[sourceLang]) return merged;

  const missing = supportedLanguages.filter((code) => code !== sourceLang && !merged[code]);
  if (!missing.length) return merged;

  try {
    const model = await resolvePreferredModel(tenantId, tenantSettings);
    const results = await aiService.translateText({
      text: merged[sourceLang],
      sourceLang,
      targetLangs: missing,
      model,
      tenantId,
      context,
    });
    for (const [code, value] of Object.entries(results)) {
      if (value) merged[code] = value;
    }
  } catch {
    // Best-effort; never block creating/updating taxonomy on AI availability.
  }
  return merged;
}

export async function listCategories(tenantId) {
  return Category.find({ tenantId }).sort({ sortOrder: 1, createdAt: 1 }).lean();
}

export async function createCategory(tenantId, { name, color, sortOrder }, tenantSettings = null) {
  const translated = await autoTranslateName(name, {
    tenantId,
    tenantSettings,
    context: CATEGORY_CONTEXT,
  });
  return Category.create({
    tenantId,
    name: translated,
    color: color || '#64748b',
    sortOrder: sortOrder || 0,
  });
}

export async function updateCategory(tenantId, id, { name, color, sortOrder }, tenantSettings = null) {
  const translated = await autoTranslateName(name, {
    tenantId,
    tenantSettings,
    context: CATEGORY_CONTEXT,
  });
  return Category.findOneAndUpdate(
    { _id: id, tenantId },
    { name: translated, color, sortOrder },
    { new: true },
  );
}

export async function fillMissingTaxonomyNames(tenantId, tenantSettings, kind) {
  const modelByKind = {
    audience: Audience,
    eventCharacter: EventCharacter,
    category: Category,
  };
  const listByKind = {
    audience: listAudiences,
    eventCharacter: listEventCharacters,
    category: listCategories,
  };
  const Model = modelByKind[kind] || Category;
  const listFn = listByKind[kind] || listCategories;
  const items = await listFn(tenantId);
  const { supportedLanguages, defaultLanguage } = resolveTenantLanguages(tenantSettings);
  let updated = 0;

  for (const item of items) {
    const name = { ...(item.name || {}) };
    const sourceLang = name[defaultLanguage]?.trim()
      ? defaultLanguage
      : Object.keys(name).find((code) => name[code]?.trim());
    if (!sourceLang) continue;

    const missing = supportedLanguages.filter((code) => code !== sourceLang && !name[code]?.trim());
    if (!missing.length) continue;

    const results = await translateTaxonomyLabel(tenantId, tenantSettings, {
      text: name[sourceLang],
      sourceLang,
      kind,
      targetLangs: missing,
    });

    let changed = false;
    for (const [code, value] of Object.entries(results)) {
      if (value && !name[code]?.trim()) {
        name[code] = value;
        changed = true;
      }
    }
    if (!changed) continue;

    await Model.findOneAndUpdate({ _id: item._id, tenantId }, { name });
    updated++;
  }

  return { updated };
}

export async function reorderCategories(tenantId, orderedIds = []) {
  const ops = orderedIds.map((id, index) => ({
    updateOne: { filter: { _id: id, tenantId }, update: { $set: { sortOrder: index } } },
  }));
  if (ops.length) await Category.bulkWrite(ops);
}

export async function deleteCategory(tenantId, id) {
  await Event.updateMany({ tenantId, categoryIds: id }, { $pull: { categoryIds: id } });
  return Category.deleteOne({ _id: id, tenantId });
}

export async function listAudiences(tenantId) {
  return Audience.find({ tenantId }).sort({ sortOrder: 1, createdAt: 1 }).lean();
}

export async function createAudience(tenantId, { name, sortOrder }, tenantSettings = null) {
  const translated = await autoTranslateName(name, {
    tenantId,
    tenantSettings,
    context: AUDIENCE_CONTEXT,
  });
  return Audience.create({ tenantId, name: translated, sortOrder: sortOrder || 0 });
}

export async function updateAudience(tenantId, id, { name, sortOrder }, tenantSettings = null) {
  const translated = await autoTranslateName(name, {
    tenantId,
    tenantSettings,
    context: AUDIENCE_CONTEXT,
  });
  return Audience.findOneAndUpdate({ _id: id, tenantId }, { name: translated, sortOrder }, { new: true });
}

export async function reorderAudiences(tenantId, orderedIds = []) {
  const ops = orderedIds.map((id, index) => ({
    updateOne: { filter: { _id: id, tenantId }, update: { $set: { sortOrder: index } } },
  }));
  if (ops.length) await Audience.bulkWrite(ops);
}

export async function deleteAudience(tenantId, id) {
  await Event.updateMany({ tenantId, audienceIds: id }, { $pull: { audienceIds: id } });
  return Audience.deleteOne({ _id: id, tenantId });
}

export async function listEventCharacters(tenantId) {
  return EventCharacter.find({ tenantId }).sort({ sortOrder: 1, createdAt: 1 }).lean();
}

export async function createEventCharacter(tenantId, { name, sortOrder }, tenantSettings = null) {
  const translated = await autoTranslateName(name, {
    tenantId,
    tenantSettings,
    context: EVENT_CHARACTER_CONTEXT,
  });
  return EventCharacter.create({ tenantId, name: translated, sortOrder: sortOrder || 0 });
}

export async function updateEventCharacter(tenantId, id, { name, sortOrder }, tenantSettings = null) {
  const translated = await autoTranslateName(name, {
    tenantId,
    tenantSettings,
    context: EVENT_CHARACTER_CONTEXT,
  });
  return EventCharacter.findOneAndUpdate(
    { _id: id, tenantId },
    { name: translated, sortOrder },
    { new: true },
  );
}

export async function reorderEventCharacters(tenantId, orderedIds = []) {
  const ops = orderedIds.map((id, index) => ({
    updateOne: { filter: { _id: id, tenantId }, update: { $set: { sortOrder: index } } },
  }));
  if (ops.length) await EventCharacter.bulkWrite(ops);
}

export async function deleteEventCharacter(tenantId, id) {
  await Event.updateMany({ tenantId, eventCharacterIds: id }, { $pull: { eventCharacterIds: id } });
  return EventCharacter.deleteOne({ _id: id, tenantId });
}
