import express from 'express';

import { asyncHandler } from '../../../lib/asyncHandler.js';

import { aiLimiter } from '../../../middleware/rateLimiters.js';

import { requirePermission, eventScope } from '../../../middleware/requireRole.js';

import * as aiService from '../../../services/aiService.js';

import * as eventService from '../../../services/eventService.js';

import { listCategories, listAudiences } from '../../../services/taxonomyService.js';

import { sanitizeHtml } from '../../../lib/sanitize.js';

import { applyEventTranslations, resolveLabel } from '../../../lib/i18n.js';

import { audit } from '../../../services/auditService.js';

import { notify } from '../../../services/notificationService.js';

import {

  AUDIT_ACTIONS,

  MARKETING_PLATFORMS,

  NOTIFICATION_TYPES,

  EVENT_STATUS,

  TENANT_PERMISSIONS,

} from '../../../config/constants.js';

import env from '../../../config/env.js';

import { createShareLink, buildShortShareUrl } from '../../../lib/calendarLink.js';

const router = express.Router({ mergeParams: true });

function supportedLangs(req) {
  return req.tenantSettings.supportedLanguages || [];
}



function parseTargetLangs(body, supported, sourceLang) {

  let targetLangs = body.targetLangs || [];

  if (!Array.isArray(targetLangs)) targetLangs = [targetLangs];

  return targetLangs.filter((l) => supported.includes(l) && l !== sourceLang);

}



// --- AI translation (preview) ---

router.post(

  '/translate/:eventId/preview',

  aiLimiter,

  asyncHandler(async (req, res) => {

    const event = await eventService.getEvent(req.tenant._id, req.params.eventId, eventScope(req));

    if (!event) return res.status(404).json({ error: 'Not found' });



    const supported = supportedLangs(req);

    const sourceLang = req.body.sourceLang;

    if (!supported.includes(sourceLang)) {

      return res.status(400).json({ error: 'Source language is not enabled for this calendar.' });

    }



    const targetLangs = parseTargetLangs(req.body, supported, sourceLang);

    if (!targetLangs.length) {

      return res.status(400).json({ error: 'Select at least one target language (other than the source).' });

    }



    try {

      const results = await aiService.translateEvent({
        event,
        sourceLang,
        targetLangs,
        model: req.tenantSettings.aiPreferredModel,
        tenantId: req.tenant._id,
      });

      await audit({

        tenantId: req.tenant._id,

        actor: req.user,

        action: AUDIT_ACTIONS.TRANSLATION_EXECUTED,

        entityType: 'event',

        entityId: event._id,

        metadata: { sourceLang, targetLangs },

      });

      res.json({ results });

    } catch (err) {

      res.status(400).json({ error: err.message });

    }

  }),

);



// --- AI translation (save edited preview) ---

router.post(

  '/translate/:eventId/save',

  asyncHandler(async (req, res) => {

    const event = await eventService.getEvent(req.tenant._id, req.params.eventId, eventScope(req));

    if (!event) return res.status(404).json({ error: 'Not found' });



    const supported = supportedLangs(req);

    const incoming = req.body.translations || {};

    const entries = {};



    for (const code of supported) {

      const t = incoming[code];

      if (t && (t.title || t.descriptionHtml)) {

        entries[code] = {

          title: (t.title || '').trim(),

          descriptionHtml: sanitizeHtml(t.descriptionHtml || ''),

        };

      }

    }



    if (!Object.keys(entries).length) {

      return res.status(400).json({ error: 'No translations to save.' });

    }



    applyEventTranslations(event, entries);

    event.lastModifiedBy = req.user._id;

    await event.save();



    await notify({

      userId: req.user._id,

      tenantId: req.tenant._id,

      type: NOTIFICATION_TYPES.TRANSLATION_COMPLETED,

      title: 'Translation saved',

      body: event.titleIn(req.tenantSettings.defaultLanguage),

      link: `/admin/${req.tenant.slug}/events/${event._id}/edit`,

    });



    res.json({ ok: true, saved: Object.keys(entries) });

  }),

);



// --- AI marketing generator (manager only) ---

router.get(

  '/marketing',

  requirePermission(TENANT_PERMISSIONS.AI_MARKETING),

  asyncHandler(async (req, res) => {

    const [categories, audiences] = await Promise.all([

      listCategories(req.tenant._id),

      listAudiences(req.tenant._id),

    ]);

    res.render('admin/marketing', {

      title: 'AI Marketing',

      activeNav: 'marketing',

      categories,

      audiences,

      platforms: MARKETING_PLATFORMS,

      result: null,

      calendarLink: null,

      form: {},

    });

  }),

);



router.post(

  '/marketing',

  requirePermission(TENANT_PERMISSIONS.AI_MARKETING),

  aiLimiter,

  asyncHandler(async (req, res) => {

    const [categories, audiences] = await Promise.all([

      listCategories(req.tenant._id),

      listAudiences(req.tenant._id),

    ]);



    const filters = {

      from: req.body.from,

      to: req.body.to,

      category: req.body.category,

      audience: req.body.audience,

      status: EVENT_STATUS.PUBLISHED,

    };

    const { items } = await eventService.listEvents(req.tenant._id, {
      filters,
      sort: 'upcoming',
      limit: 20,
      tenantSettings: req.tenantSettings,
    });



    let result = null;
    let error = null;
    let calendarLink = null;

    const language = req.body.language || req.tenantSettings.defaultLanguage;
    const includeCalendarLink =
      req.body.includeCalendarLink === 'on' || req.body.includeCalendarLink === true;

    if (includeCalendarLink) {
      const code = await createShareLink(req.tenant._id, req.user._id, {
        from: req.body.from,
        to: req.body.to,
        category: req.body.category,
        audience: req.body.audience,
        lang: language,
        view: req.body.calendarView || 'list',
      });
      calendarLink = buildShortShareUrl(env.appBaseUrl, code);
    }

    try {

      result = await aiService.generateMarketing({
        tenantPrompt: req.tenantSettings.aiDefaultPrompt,
        events: await hydrate(items),
        language,
        platform: req.body.platform || 'facebook',
        audience: labelFor(audiences, req.body.audience, req.tenantSettings.defaultLanguage),
        categories: labelFor(categories, req.body.category, req.tenantSettings.defaultLanguage),
        keywords: req.body.keywords || '',
        model: req.tenantSettings.aiPreferredModel,
        tenantId: req.tenant._id,
        calendarLink: calendarLink || '',
      });

      await audit({

        tenantId: req.tenant._id,

        actor: req.user,

        action: AUDIT_ACTIONS.MARKETING_GENERATED,

        entityType: 'tenant',

        metadata: { platform: req.body.platform, count: items.length, includeCalendarLink },

      });

    } catch (err) {

      error = err.message;

    }



    res.render('admin/marketing', {

      title: 'AI Marketing',

      activeNav: 'marketing',

      categories,

      audiences,

      platforms: MARKETING_PLATFORMS,

      result,

      error,

      matchedCount: items.length,

      calendarLink,

      form: req.body,

    });

  }),

);



async function hydrate(items) {

  const Event = (await import('../../../models/Event.js')).default;

  const ids = items.map((i) => i._id);

  return Event.find({ _id: { $in: ids } });

}



function labelFor(list, id, lang) {

  if (!id) return '';

  const item = list.find((x) => String(x._id) === String(id));

  if (!item) return '';

  return resolveLabel(item.name, lang, [lang]);

}



export default router;


