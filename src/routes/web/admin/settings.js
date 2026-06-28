import express from 'express';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { requireManager } from '../../../middleware/requireRole.js';
import { updateSettings as updateTenantSettings } from '../../../services/tenantService.js';
import { availableModels } from '../../../services/aiService.js';
import { listTokens, createToken, revokeToken } from '../../../services/apiTokenService.js';
import { audit } from '../../../services/auditService.js';
import { AUDIT_ACTIONS, LANGUAGE_CODES, API_SCOPES } from '../../../config/constants.js';
import { translate } from '../../../lib/ui-i18n.js';
import { resolveTenantLanguages } from '../../../lib/tenantLanguages.js';

const router = express.Router({ mergeParams: true });

function lang(req) {
  return req.tenantSettings.defaultLanguage;
}

router.use(requireManager);

function base(req) {
  return `/admin/${req.tenant.slug}`;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    let models = [];
    let modelError = null;
    try {
      models = await availableModels(req.tenant._id);
    } catch (err) {
      modelError = err.message;
    }
    const tokens = await listTokens(req.tenant._id);
    res.render('admin/settings', {
      title: 'Calendar Settings',
      activeNav: 'settings',
      models,
      modelError,
      tokens,
      apiScopes: API_SCOPES,
      newToken: req.session.newToken || null,
    });
    req.session.newToken = null;
  }),
);

router.post(
  '/general',
  asyncHandler(async (req, res) => {
    await updateTenantSettings(req.tenant._id, {
      description: req.body.description || '',
      'colors.primary': req.body.primaryColor,
      'colors.secondary': req.body.secondaryColor,
      logoMediaId: req.body.logoMediaId || null,
      'seo.title': req.body.seoTitle || '',
      'seo.description': req.body.seoDescription || '',
    });
    // Tenant name lives on the Tenant doc; update it too.
    req.tenant.name = req.body.name || req.tenant.name;
    await req.tenant.save();
    await audit({ tenantId: req.tenant._id, actor: req.user, action: AUDIT_ACTIONS.SETTINGS_UPDATED, entityType: 'tenant', metadata: { section: 'general' } });
    req.flash('success', translate('flash.generalSaved', lang(req)));
    res.redirect(`${base(req)}/settings`);
  }),
);

router.post(
  '/localization',
  asyncHandler(async (req, res) => {
    const supported = LANGUAGE_CODES.filter((c) => {
      const v = req.body[`lang_${c}`];
      return v === 'on' || v === 'true';
    });
    const defaultLanguage = LANGUAGE_CODES.includes(req.body.defaultLanguage)
      ? req.body.defaultLanguage
      : req.tenantSettings.defaultLanguage;
    const langs = resolveTenantLanguages({
      defaultLanguage,
      supportedLanguages: supported.length ? supported : [defaultLanguage],
      timezone: req.body.timezone || req.tenantSettings.timezone,
      dateFormat: req.body.dateFormat || req.tenantSettings.dateFormat,
    });
    await updateTenantSettings(req.tenant._id, {
      supportedLanguages: langs.supportedLanguages,
      defaultLanguage: langs.defaultLanguage,
      timezone: req.body.timezone || req.tenantSettings.timezone,
      dateFormat: req.body.dateFormat || req.tenantSettings.dateFormat,
    });
    await audit({ tenantId: req.tenant._id, actor: req.user, action: AUDIT_ACTIONS.SETTINGS_UPDATED, entityType: 'tenant', metadata: { section: 'localization' } });
    req.flash('success', translate('flash.localizationSaved', lang(req)));
    res.redirect(`${base(req)}/settings`);
  }),
);

router.post(
  '/ai',
  asyncHandler(async (req, res) => {
    await updateTenantSettings(req.tenant._id, {
      aiDefaultPrompt: req.body.aiDefaultPrompt || '',
      aiPreferredModel: req.body.aiPreferredModel || req.tenantSettings.aiPreferredModel,
      autoTranslateOnSave: req.body.autoTranslateOnSave === 'on',
    });
    await audit({ tenantId: req.tenant._id, actor: req.user, action: AUDIT_ACTIONS.AI_CONFIG_CHANGED, entityType: 'tenant', metadata: { model: req.body.aiPreferredModel } });
    req.flash('success', translate('flash.aiSaved', lang(req)));
    res.redirect(`${base(req)}/settings`);
  }),
);

// API tokens
router.post(
  '/tokens',
  asyncHandler(async (req, res) => {
    const scopes = API_SCOPES.filter((s) => {
      const v = req.body[`scope_${s}`];
      return v === 'on' || v === 'true';
    });
    const { raw } = await createToken(req.tenant._id, req.user._id, {
      name: req.body.name || 'API token',
      scopes,
      webhookUrl: req.body.webhookUrl || '',
    });
    await audit({ tenantId: req.tenant._id, actor: req.user, action: AUDIT_ACTIONS.TOKEN_CREATED, entityType: 'token' });
    // Show the raw token once.
    req.session.newToken = raw;
    req.flash('success', translate('flash.tokenCreated', lang(req)));
    res.redirect(`${base(req)}/settings`);
  }),
);

router.post(
  '/tokens/:id/revoke',
  asyncHandler(async (req, res) => {
    await revokeToken(req.tenant._id, req.params.id);
    await audit({ tenantId: req.tenant._id, actor: req.user, action: AUDIT_ACTIONS.TOKEN_REVOKED, entityType: 'token', entityId: req.params.id });
    req.flash('success', translate('flash.tokenRevoked', lang(req)));
    res.redirect(`${base(req)}/settings`);
  }),
);

export default router;
