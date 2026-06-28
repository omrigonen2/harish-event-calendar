import express from 'express';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { requireManager } from '../../../middleware/requireRole.js';
import * as taxonomy from '../../../services/taxonomyService.js';
import { audit } from '../../../services/auditService.js';
import { AUDIT_ACTIONS } from '../../../config/constants.js';
import { translate } from '../../../lib/ui-i18n.js';

const router = express.Router({ mergeParams: true });

function lang(req) {
  return req.tenantSettings.defaultLanguage;
}

router.use(requireManager);

function base(req) {
  return `/admin/${req.tenant.slug}`;
}

function nameMapFromBody(body, supportedLanguages) {
  const map = {};
  for (const code of supportedLanguages) {
    const v = (body[`name_${code}`] || '').trim();
    if (v) map[code] = v;
  }
  return map;
}

function supported(req) {
  return req.tenantSettings.supportedLanguages || [];
}

// Categories
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const categories = await taxonomy.listCategories(req.tenant._id);
    res.render('admin/categories', { title: 'Categories', activeNav: 'categories', categories });
  }),
);

router.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const cat = await taxonomy.createCategory(req.tenant._id, {
      name: nameMapFromBody(req.body, supported(req)),
      color: req.body.color,
      sortOrder: Number(req.body.sortOrder) || 0,
    }, req.tenantSettings);
    await audit({ tenantId: req.tenant._id, actor: req.user, action: AUDIT_ACTIONS.CATEGORY_CREATED, entityType: 'category', entityId: cat._id });
    req.flash('success', translate('flash.categoryCreated', lang(req)));
    res.redirect(`${base(req)}/categories`);
  }),
);

router.post(
  '/categories/reorder',
  asyncHandler(async (req, res) => {
    const order = Array.isArray(req.body.order) ? req.body.order : [];
    await taxonomy.reorderCategories(req.tenant._id, order);
    res.json({ ok: true });
  }),
);

router.post(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    await taxonomy.updateCategory(req.tenant._id, req.params.id, {
      name: nameMapFromBody(req.body, supported(req)),
      color: req.body.color,
      sortOrder: Number(req.body.sortOrder) || 0,
    }, req.tenantSettings);
    req.flash('success', translate('flash.categoryUpdated', lang(req)));
    res.redirect(`${base(req)}/categories`);
  }),
);

router.post(
  '/categories/:id/delete',
  asyncHandler(async (req, res) => {
    await taxonomy.deleteCategory(req.tenant._id, req.params.id);
    await audit({ tenantId: req.tenant._id, actor: req.user, action: AUDIT_ACTIONS.CATEGORY_DELETED, entityType: 'category', entityId: req.params.id });
    req.flash('success', translate('flash.categoryDeleted', lang(req)));
    res.redirect(`${base(req)}/categories`);
  }),
);

// Audiences
router.get(
  '/audiences',
  asyncHandler(async (req, res) => {
    const audiences = await taxonomy.listAudiences(req.tenant._id);
    res.render('admin/audiences', { title: 'Audiences', activeNav: 'audiences', audiences });
  }),
);

router.post(
  '/audiences',
  asyncHandler(async (req, res) => {
    const aud = await taxonomy.createAudience(req.tenant._id, {
      name: nameMapFromBody(req.body, supported(req)),
      sortOrder: Number(req.body.sortOrder) || 0,
    }, req.tenantSettings);
    await audit({ tenantId: req.tenant._id, actor: req.user, action: AUDIT_ACTIONS.AUDIENCE_CREATED, entityType: 'audience', entityId: aud._id });
    req.flash('success', translate('flash.audienceCreated', lang(req)));
    res.redirect(`${base(req)}/audiences`);
  }),
);

router.post(
  '/audiences/reorder',
  asyncHandler(async (req, res) => {
    const order = Array.isArray(req.body.order) ? req.body.order : [];
    await taxonomy.reorderAudiences(req.tenant._id, order);
    res.json({ ok: true });
  }),
);

router.post(
  '/audiences/:id',
  asyncHandler(async (req, res) => {
    await taxonomy.updateAudience(req.tenant._id, req.params.id, {
      name: nameMapFromBody(req.body, supported(req)),
      sortOrder: Number(req.body.sortOrder) || 0,
    }, req.tenantSettings);
    req.flash('success', translate('flash.audienceUpdated', lang(req)));
    res.redirect(`${base(req)}/audiences`);
  }),
);

router.post(
  '/audiences/:id/delete',
  asyncHandler(async (req, res) => {
    await taxonomy.deleteAudience(req.tenant._id, req.params.id);
    await audit({ tenantId: req.tenant._id, actor: req.user, action: AUDIT_ACTIONS.AUDIENCE_DELETED, entityType: 'audience', entityId: req.params.id });
    req.flash('success', translate('flash.audienceDeleted', lang(req)));
    res.redirect(`${base(req)}/audiences`);
  }),
);

// Event characters (אופי האירוע)
router.get(
  '/event-characters',
  asyncHandler(async (req, res) => {
    const eventCharacters = await taxonomy.listEventCharacters(req.tenant._id);
    res.render('admin/event-characters', {
      title: 'Event characters',
      activeNav: 'eventCharacters',
      eventCharacters,
    });
  }),
);

router.post(
  '/event-characters',
  asyncHandler(async (req, res) => {
    const item = await taxonomy.createEventCharacter(req.tenant._id, {
      name: nameMapFromBody(req.body, supported(req)),
      sortOrder: Number(req.body.sortOrder) || 0,
    }, req.tenantSettings);
    await audit({
      tenantId: req.tenant._id,
      actor: req.user,
      action: AUDIT_ACTIONS.EVENT_CHARACTER_CREATED,
      entityType: 'eventCharacter',
      entityId: item._id,
    });
    req.flash('success', translate('flash.eventCharacterCreated', lang(req)));
    res.redirect(`${base(req)}/event-characters`);
  }),
);

router.post(
  '/event-characters/reorder',
  asyncHandler(async (req, res) => {
    const order = Array.isArray(req.body.order) ? req.body.order : [];
    await taxonomy.reorderEventCharacters(req.tenant._id, order);
    res.json({ ok: true });
  }),
);

router.post(
  '/event-characters/:id',
  asyncHandler(async (req, res) => {
    await taxonomy.updateEventCharacter(req.tenant._id, req.params.id, {
      name: nameMapFromBody(req.body, supported(req)),
      sortOrder: Number(req.body.sortOrder) || 0,
    }, req.tenantSettings);
    req.flash('success', translate('flash.eventCharacterUpdated', lang(req)));
    res.redirect(`${base(req)}/event-characters`);
  }),
);

router.post(
  '/event-characters/:id/delete',
  asyncHandler(async (req, res) => {
    await taxonomy.deleteEventCharacter(req.tenant._id, req.params.id);
    await audit({
      tenantId: req.tenant._id,
      actor: req.user,
      action: AUDIT_ACTIONS.EVENT_CHARACTER_DELETED,
      entityType: 'eventCharacter',
      entityId: req.params.id,
    });
    req.flash('success', translate('flash.eventCharacterDeleted', lang(req)));
    res.redirect(`${base(req)}/event-characters`);
  }),
);

// Fill missing translations for every taxonomy item of the given kind.
const fillMissingHandler = asyncHandler(async (req, res) => {
  const requested = req.body.kind || req.query.kind;
  const kind = ['audience', 'eventCharacter'].includes(requested) ? requested : 'category';
  const { updated } = await taxonomy.fillMissingTaxonomyNames(
    req.tenant._id,
    req.tenantSettings,
    kind,
  );
  const uiLang = lang(req);
  if (updated) {
    req.flash('success', translate('flash.taxonomyMissingFilled', uiLang, { count: updated }));
  } else {
    req.flash('info', translate('flash.taxonomyNothingMissing', uiLang));
  }
  const pathByKind = {
    category: 'categories',
    audience: 'audiences',
    eventCharacter: 'event-characters',
  };
  res.redirect(`${base(req)}/${pathByKind[kind]}`);
});

router.get('/taxonomy/fill-missing', fillMissingHandler);
router.post('/taxonomy/fill-missing', fillMissingHandler);

// AI translation for a single taxonomy label (used by the inline translate button).
router.post(
  '/taxonomy/translate',
  asyncHandler(async (req, res) => {
    try {
      const results = await taxonomy.translateTaxonomyLabel(req.tenant._id, req.tenantSettings, {
        text: req.body.text,
        sourceLang: req.body.sourceLang,
        kind: req.body.kind,
        targetLangs: req.body.targetLangs,
      });
      res.json({ results });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }),
);

export default router;
