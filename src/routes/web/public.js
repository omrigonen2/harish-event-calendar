import express from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { resolveTenantPublic } from '../../middleware/resolveTenant.js';
import * as eventService from '../../services/eventService.js';
import { listCategories, listAudiences, listEventCharacters } from '../../services/taxonomyService.js';
import { urlFor } from '../../services/mediaService.js';
import { buildEventIcs } from '../../lib/ics.js';
import { stripHtml } from '../../lib/sanitize.js';
import { resolveEventTranslation, resolveLabel } from '../../lib/i18n.js';
import { EVENT_STATUS, isRtl } from '../../config/constants.js';
import env from '../../config/env.js';
import {
  pickCalendarContext,
  buildEventUrl,
  buildCalendarBackUrl,
  buildClearFiltersUrl,
  hasActivePublicFilters,
} from '../../lib/calendarLink.js';

const router = express.Router({ mergeParams: true });

router.use(resolveTenantPublic);

const VIEWS = ['month', 'week', 'day', 'agenda', 'list', 'cards'];

function pickLang(req) {
  const supported = req.tenantSettings.supportedLanguages || [];
  const requested = req.query.lang;
  if (requested && supported.includes(requested)) return requested;
  return req.tenantSettings.defaultLanguage;
}

function publicFilters(req) {
  return {
    status: EVENT_STATUS.PUBLISHED,
    category: req.query.category,
    audience: req.query.audience,
    character: req.query.character,
    price: req.query.price,
    from: req.query.from,
    to: req.query.to,
    q: req.query.q,
  };
}

async function loadCalendarData(req) {
  const view = VIEWS.includes(req.query.view) ? req.query.view : 'month';
  const lang = pickLang(req);
  const filters = publicFilters(req);
  const calendarContext = pickCalendarContext(req.query);

  const [{ items }, categories, audiences, eventCharacters] = await Promise.all([
    eventService.listEvents(req.tenant._id, {
      filters,
      sort: 'upcoming',
      limit: 500,
      tenantSettings: req.tenantSettings,
    }),
    listCategories(req.tenant._id),
    listAudiences(req.tenant._id),
    listEventCharacters(req.tenant._id),
  ]);

  const fallback = [req.tenantSettings.defaultLanguage].filter((c) => c !== lang);
  const events = items.map((ev) => {
    const tr = resolveEventTranslation(ev.translations, lang, fallback);
    const characters = (ev.eventCharacterIds || [])
      .map((c) => resolveLabel(c.name, lang, fallback))
      .filter(Boolean);
    return {
      id: String(ev._id),
      title: tr.title || '(untitled)',
      start: ev.startAt,
      end: ev.endAt,
      allDay: ev.allDay,
      url: buildEventUrl(req.tenant.slug, ev._id, calendarContext),
      category: ev.categoryIds?.[0]?.color || req.tenantSettings.colors.primary,
      characters,
      coverMediaId: ev.coverMediaId,
      excerpt: stripHtml(tr.descriptionHtml || '').slice(0, 160),
      isFree: ev.pricing?.isFree,
      price: ev.pricing?.price,
      currency: ev.pricing?.currency,
    };
  });

  const showClearFilters = req.query.share === '1' && hasActivePublicFilters(filters);
  const base = `/c/${req.tenant.slug}`;

  return {
    view,
    lang,
    dir: isRtl(lang) ? 'rtl' : 'ltr',
    events,
    categories,
    audiences,
    eventCharacters,
    filters,
    views: VIEWS,
    showClearFilters,
    clearFiltersUrl: buildClearFiltersUrl(req.tenant.slug, { lang, view }),
    base,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await loadCalendarData(req);

    if (req.query.partial === '1') {
      return res.render('public/calendar-content', {
        layout: false,
        title: req.tenant.name,
        ...data,
      });
    }

    res.render('public/calendar', {
      title: req.tenant.name,
      layout: 'layouts/public',
      ...data,
    });
  }),
);

router.get(
  '/events/:id',
  asyncHandler(async (req, res) => {
    const lang = pickLang(req);
    const calendarContext = pickCalendarContext(req.query);
    const event = await eventService.getEvent(req.tenant._id, req.params.id);
    if (!event || event.status !== EVENT_STATUS.PUBLISHED) {
      return res.status(404).render('errors/404', { title: 'Not found' });
    }
    const fallback = [req.tenantSettings.defaultLanguage].filter((c) => c !== lang);
    const tr = resolveEventTranslation(event.translations, lang, fallback);
    const title = tr.title || event.titleIn(lang, fallback);
    const primary = event.translations?.get ? event.translations.get(lang) : event.translations?.[lang];
    const usedFallback = !(primary && primary.title);

    let coverUrl = null;
    if (event.coverMediaId) {
      coverUrl = `/c/${req.tenant.slug}/media/${event.coverMediaId}/raw`;
    }

    res.render('public/event', {
      title,
      layout: 'layouts/public',
      lang,
      dir: isRtl(lang) ? 'rtl' : 'ltr',
      event,
      content: tr,
      eventTitle: title,
      usedFallback,
      coverUrl,
      calendarBackUrl: buildCalendarBackUrl(req.tenant.slug, calendarContext),
      icsUrl: `/c/${req.tenant.slug}/events/${event._id}/ics?lang=${lang}`,
    });
  }),
);

router.get(
  '/events/:id/ics',
  asyncHandler(async (req, res) => {
    const lang = pickLang(req);
    const event = await eventService.getEvent(req.tenant._id, req.params.id);
    if (!event || event.status !== EVENT_STATUS.PUBLISHED) {
      return res.status(404).end();
    }
    const fallback = [req.tenantSettings.defaultLanguage].filter((c) => c !== lang);
    const tr = resolveEventTranslation(event.translations, lang, fallback);
    const ics = buildEventIcs({
      uid: `${event._id}@${req.tenant.slug}`,
      title: tr.title || event.titleIn(lang, fallback),
      description: stripHtml(tr.descriptionHtml || ''),
      start: event.startAt,
      end: event.endAt,
      url: `${env.appBaseUrl}/c/${req.tenant.slug}/events/${event._id}`,
    });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="event-${event._id}.ics"`);
    res.send(ics);
  }),
);

router.get(
  '/media/:id/raw',
  asyncHandler(async (req, res) => {
    const url = await urlFor(req.tenant._id, req.params.id);
    if (!url) return res.status(404).end();
    res.redirect(url);
  }),
);

export default router;
