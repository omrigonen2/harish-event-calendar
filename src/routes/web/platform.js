import express from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth, requireSuperAdmin } from '../../middleware/requireAuth.js';
import {
  listTenants,
  createTenant,
  setStatus,
} from '../../services/tenantService.js';
import {
  getMaskedSettings,
  updateSettings,
  getS3Config,
  getOpenAIConfig,
  getMaskedTenantIntegrations,
  updateTenantIntegrations,
  clearTenantIntegrationOverride,
} from '../../services/settingsService.js';
import { getTenantById } from '../../services/tenantService.js';
import { listTenantUsers, addUserDirect } from '../../services/userService.js';
import { listModels } from '../../lib/openai.js';
import { putObject } from '../../lib/s3.js';
import { sendTemplate, templates } from '../../services/emailService.js';
import { audit } from '../../services/auditService.js';
import { listAudit } from '../../services/auditService.js';
import { AUDIT_ACTIONS, TENANT_STATUS, DEFAULT_LANGUAGE, TENANT_PERMISSIONS } from '../../config/constants.js';
import { normalizePermissions } from '../../lib/permissions.js';
import { translate } from '../../lib/ui-i18n.js';

const L = DEFAULT_LANGUAGE;

const router = express.Router();

router.use(requireAuth, requireSuperAdmin);

// Tenants
router.get(
  '/tenants',
  asyncHandler(async (req, res) => {
    const tenants = await listTenants();
    res.render('platform/tenants', { title: 'Tenants', tenants });
  }),
);

router.post(
  '/tenants',
  asyncHandler(async (req, res) => {
    const tenant = await createTenant({ name: req.body.name, slug: req.body.slug });
    await audit({
      actor: req.user,
      action: AUDIT_ACTIONS.TENANT_CREATED,
      entityType: 'tenant',
      entityId: tenant._id,
      metadata: { slug: tenant.slug },
    });
    req.flash('success', translate('flash.tenantCreated', L, { name: tenant.name }));
    res.redirect('/platform/tenants');
  }),
);

router.post(
  '/tenants/:id/status',
  asyncHandler(async (req, res) => {
    const status =
      req.body.status === TENANT_STATUS.SUSPENDED ? TENANT_STATUS.SUSPENDED : TENANT_STATUS.ACTIVE;
    const tenant = await setStatus(req.params.id, status);
    await audit({
      actor: req.user,
      action: AUDIT_ACTIONS.TENANT_SUSPENDED,
      entityType: 'tenant',
      entityId: tenant._id,
      metadata: { status },
    });
    req.flash('success', translate('flash.tenantStatus', L, { status: translate(`status.${status}`, L) }));
    res.redirect('/platform/tenants');
  }),
);

// Tenant users (super admin can add users directly with a password)
router.get(
  '/tenants/:id/users',
  asyncHandler(async (req, res) => {
    const tenant = await getTenantById(req.params.id);
    if (!tenant) return res.status(404).render('errors/404', { title: 'Not found' });
    const users = await listTenantUsers(tenant._id);
    res.render('platform/tenant-users', {
      title: `Users — ${tenant.name}`,
      tenant,
      users,
      tenantId: tenant._id,
    });
  }),
);

router.post(
  '/tenants/:id/users',
  asyncHandler(async (req, res) => {
    const tenant = await getTenantById(req.params.id);
    if (!tenant) return res.status(404).render('errors/404', { title: 'Not found' });
    if (!req.body.email || !req.body.password) {
      req.flash('error', translate('flash.userAddFailed', L));
      return res.redirect(`/platform/tenants/${tenant._id}/users`);
    }
    const permissions = normalizePermissions({
      [TENANT_PERMISSIONS.EVENTS_WRITE]: req.body[TENANT_PERMISSIONS.EVENTS_WRITE],
      [TENANT_PERMISSIONS.EVENTS_PUBLISH]: req.body[TENANT_PERMISSIONS.EVENTS_PUBLISH],
      [TENANT_PERMISSIONS.EVENTS_SCOPE_ALL]: req.body[TENANT_PERMISSIONS.EVENTS_SCOPE_ALL],
      [TENANT_PERMISSIONS.AI_MARKETING]: req.body[TENANT_PERMISSIONS.AI_MARKETING],
      [TENANT_PERMISSIONS.TENANT_MANAGE]: req.body[TENANT_PERMISSIONS.TENANT_MANAGE],
    });
    const user = await addUserDirect(tenant._id, {
      email: req.body.email,
      name: req.body.name,
      password: req.body.password,
      permissions,
    });
    await audit({
      tenantId: tenant._id,
      actor: req.user,
      action: AUDIT_ACTIONS.USER_CREATED,
      entityType: 'user',
      entityId: user._id,
      metadata: { email: user.email, permissions },
    });
    req.flash('success', translate('flash.userAdded', L, { email: user.email }));
    res.redirect(`/platform/tenants/${tenant._id}/users`);
  }),
);

// Per-tenant integration overrides (optional; defaults come from platform settings)
router.get(
  '/tenants/:id/integrations',
  asyncHandler(async (req, res) => {
    const tenant = await getTenantById(req.params.id);
    if (!tenant) return res.status(404).render('errors/404', { title: 'Not found' });
    const platformSettings = await getMaskedSettings();
    const tenantIntegrations = await getMaskedTenantIntegrations(tenant._id);
    res.render('platform/tenant-integrations', {
      title: `Integrations — ${tenant.name}`,
      tenant,
      platformSettings,
      tenantIntegrations,
    });
  }),
);

router.post(
  '/tenants/:id/integrations/:section',
  asyncHandler(async (req, res) => {
    const section = req.params.section;
    if (!['s3', 'openai', 'resend'].includes(section)) {
      return res.status(400).render('errors/404', { title: 'Not found' });
    }
    const tenant = await getTenantById(req.params.id);
    if (!tenant) return res.status(404).render('errors/404', { title: 'Not found' });
    await updateTenantIntegrations(tenant._id, section, req.body);
    await audit({
      actor: req.user,
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: 'tenant',
      entityId: tenant._id,
      metadata: { section: `integrations.${section}`, override: req.body.override === 'on' },
    });
    req.flash('success', translate('flash.overrideSaved', L, { section: section.toUpperCase() }));
    res.redirect(`/platform/tenants/${tenant._id}/integrations`);
  }),
);

router.post(
  '/tenants/:id/integrations/:section/clear',
  asyncHandler(async (req, res) => {
    const section = req.params.section;
    if (!['s3', 'openai', 'resend'].includes(section)) {
      return res.status(400).render('errors/404', { title: 'Not found' });
    }
    const tenant = await getTenantById(req.params.id);
    if (!tenant) return res.status(404).render('errors/404', { title: 'Not found' });
    await clearTenantIntegrationOverride(tenant._id, section);
    await audit({
      actor: req.user,
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: 'tenant',
      entityId: tenant._id,
      metadata: { section: `integrations.${section}`, override: false },
    });
    req.flash('success', translate('flash.overrideCleared', L, { section: section.toUpperCase() }));
    res.redirect(`/platform/tenants/${tenant._id}/integrations`);
  }),
);

router.post(
  '/tenants/:id/integrations/test/s3',
  asyncHandler(async (req, res) => {
    const tenant = await getTenantById(req.params.id);
    if (!tenant) return res.status(404).render('errors/404', { title: 'Not found' });
    const config = await getS3Config(tenant._id);
    try {
      const key = `_healthcheck/${tenant.slug}/${Date.now()}.txt`;
      await putObject(config, { key, body: Buffer.from('ok'), contentType: 'text/plain' });
      req.flash('success', translate('flash.s3TestOk', L));
    } catch (err) {
      req.flash('error', translate('flash.s3TestFail', L, { message: err.message }));
    }
    res.redirect(`/platform/tenants/${tenant._id}/integrations`);
  }),
);

router.post(
  '/tenants/:id/integrations/test/openai',
  asyncHandler(async (req, res) => {
    const tenant = await getTenantById(req.params.id);
    if (!tenant) return res.status(404).render('errors/404', { title: 'Not found' });
    const config = await getOpenAIConfig(tenant._id);
    try {
      const models = await listModels(config);
      req.flash('success', translate('flash.openaiTestOk', L, { count: models.length }));
    } catch (err) {
      req.flash('error', translate('flash.openaiTestFail', L, { message: err.message }));
    }
    res.redirect(`/platform/tenants/${tenant._id}/integrations`);
  }),
);

router.post(
  '/tenants/:id/integrations/test/resend',
  asyncHandler(async (req, res) => {
    const tenant = await getTenantById(req.params.id);
    if (!tenant) return res.status(404).render('errors/404', { title: 'Not found' });
    try {
      await sendTemplate(req.user.email, templates.test(), tenant._id);
      req.flash('success', translate('flash.emailTestOk', L, { email: req.user.email }));
    } catch (err) {
      req.flash('error', translate('flash.emailTestFail', L, { message: err.message }));
    }
    res.redirect(`/platform/tenants/${tenant._id}/integrations`);
  }),
);

// Platform settings
router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const platformSettings = await getMaskedSettings();
    let models = [];
    let modelError = null;
    try {
      const config = await getOpenAIConfig();
      models = await listModels(config);
    } catch (err) {
      modelError = err.message;
    }
    res.render('platform/settings', {
      title: res.locals.t('platform.integrations'),
      platformSettings,
      models,
      modelError,
      testResult: null,
    });
  }),
);

router.post(
  '/settings/:section',
  asyncHandler(async (req, res) => {
    const section = req.params.section;
    if (!['s3', 'openai', 'resend'].includes(section)) {
      return res.status(400).render('errors/404', { title: 'Not found' });
    }
    await updateSettings(section, req.body);
    await audit({
      actor: req.user,
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: 'platform',
      metadata: { section },
    });
    req.flash('success', translate('flash.platformSettingsSaved', L, { section: section.toUpperCase() }));
    return res.redirect('/platform/settings');
  }),
);

// Connection tests
router.post(
  '/settings/test/s3',
  asyncHandler(async (req, res) => {
    const config = await getS3Config();
    try {
      const key = `_healthcheck/${Date.now()}.txt`;
      await putObject(config, { key, body: Buffer.from('ok'), contentType: 'text/plain' });
      req.flash('success', translate('flash.s3TestOk', L));
    } catch (err) {
      req.flash('error', translate('flash.s3TestFail', L, { message: err.message }));
    }
    res.redirect('/platform/settings');
  }),
);

router.post(
  '/settings/test/openai',
  asyncHandler(async (req, res) => {
    const config = await getOpenAIConfig();
    try {
      const models = await listModels(config);
      req.flash('success', translate('flash.openaiTestOk', L, { count: models.length }));
    } catch (err) {
      req.flash('error', translate('flash.openaiTestFail', L, { message: err.message }));
    }
    res.redirect('/platform/settings');
  }),
);

router.post(
  '/settings/test/resend',
  asyncHandler(async (req, res) => {
    try {
      await sendTemplate(req.user.email, templates.test());
      req.flash('success', translate('flash.emailTestOk', L, { email: req.user.email }));
    } catch (err) {
      req.flash('error', translate('flash.emailTestFail', L, { message: err.message }));
    }
    res.redirect('/platform/settings');
  }),
);

// Global audit log
router.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const { items, total } = await listAudit({ action: req.query.action, limit: 200 });
    res.render('platform/audit', { title: 'Audit Log', items, total, action: req.query.action || '' });
  }),
);

export default router;
