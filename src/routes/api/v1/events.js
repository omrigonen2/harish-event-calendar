import express from 'express';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { requireScope } from '../../../middleware/apiAuth.js';
import * as eventService from '../../../services/eventService.js';
import { getSettings } from '../../../services/tenantService.js';
import { mapKeys, mapGet } from '../../../lib/i18n.js';

const router = express.Router();

function serializeTranslations(translations) {
  if (!translations) return {};
  const out = {};
  for (const code of mapKeys(translations)) {
    const tr = mapGet(translations, code);
    if (tr) out[code] = tr;
  }
  return out;
}

function serialize(ev) {
  return {
    id: String(ev._id),
    status: ev.status,
    translations: serializeTranslations(ev.translations),
    startAt: ev.startAt,
    endAt: ev.endAt,
    allDay: ev.allDay,
    categoryIds: (ev.categoryIds || []).map((c) => (c._id ? String(c._id) : String(c))),
    audienceIds: (ev.audienceIds || []).map((a) => (a._id ? String(a._id) : String(a))),
    eventCharacterIds: (ev.eventCharacterIds || []).map((c) => (c._id ? String(c._id) : String(c))),
    pricing: ev.pricing,
    coverMediaId: ev.coverMediaId,
    createdAt: ev.createdAt,
    updatedAt: ev.updatedAt,
  };
}

router.get(
  '/',
  requireScope('events:read'),
  asyncHandler(async (req, res) => {
    const filters = {
      status: req.query.status,
      category: req.query.category,
      audience: req.query.audience,
      character: req.query.character,
      from: req.query.from,
      to: req.query.to,
      q: req.query.q,
      price: req.query.price,
    };
    const page = parseInt(req.query.page || '1', 10);
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const settings = await getSettings(req.tenant._id);
    const result = await eventService.listEvents(req.tenant._id, {
      filters,
      sort: req.query.sort || 'newest',
      page,
      limit,
      tenantSettings: settings,
    });
    res.json({
      data: result.items.map(serialize),
      page: result.page,
      pages: result.pages,
      total: result.total,
    });
  }),
);

router.get(
  '/:id',
  requireScope('events:read'),
  asyncHandler(async (req, res) => {
    const event = await eventService.getEvent(req.tenant._id, req.params.id);
    if (!event) return res.status(404).json({ error: 'Not found' });
    res.json({ data: serialize(event) });
  }),
);

router.post(
  '/',
  requireScope('events:write'),
  asyncHandler(async (req, res) => {
    const settings = await getSettings(req.tenant._id);
    const createdBy = req.apiToken.createdBy;
    const event = await eventService.createEvent(req.tenant._id, createdBy, req.body, settings);
    res.status(201).json({ data: serialize(event) });
  }),
);

router.put(
  '/:id',
  requireScope('events:write'),
  asyncHandler(async (req, res) => {
    const settings = await getSettings(req.tenant._id);
    const event = await eventService.updateEvent(
      req.tenant._id,
      req.params.id,
      req.apiToken.createdBy,
      req.body,
      null,
      settings,
    );
    if (!event) return res.status(404).json({ error: 'Not found' });
    res.json({ data: serialize(event) });
  }),
);

router.post(
  '/:id/status',
  requireScope('events:write'),
  asyncHandler(async (req, res) => {
    const event = await eventService.setStatus(req.tenant._id, req.params.id, req.body.status);
    if (!event) return res.status(404).json({ error: 'Not found' });
    res.json({ data: serialize(event) });
  }),
);

router.delete(
  '/:id',
  requireScope('events:write'),
  asyncHandler(async (req, res) => {
    await eventService.deleteEvent(req.tenant._id, req.params.id);
    res.json({ ok: true });
  }),
);

export default router;
