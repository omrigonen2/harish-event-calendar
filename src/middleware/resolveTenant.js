import { getTenantBySlug, getSettings } from '../services/tenantService.js';
import { PLATFORM_ROLES, TENANT_STATUS, isRtl } from '../config/constants.js';
import { fullManagerPermissions } from '../lib/permissions.js';

// Resolve the tenant for /admin/:tenantSlug/* routes and enforce membership.
export async function resolveTenantAdmin(req, res, next) {
  const tenant = await getTenantBySlug(req.params.tenantSlug);
  if (!tenant) {
    return res.status(404).render('errors/404', { title: 'Not found' });
  }

  const isSuper = req.user?.platformRole === PLATFORM_ROLES.SUPER_ADMIN;
  const membership = req.user?.membershipFor(tenant._id);

  if (!isSuper && !membership) {
    return res.status(403).render('errors/403', { title: 'Forbidden' });
  }
  if (tenant.status === TENANT_STATUS.SUSPENDED && !isSuper) {
    return res.status(403).render('errors/suspended', { title: 'Suspended', tenant });
  }

  const settings = await getSettings(tenant._id);
  const permissions = isSuper
    ? fullManagerPermissions()
    : req.user.permissionsFor(tenant._id);
  req.tenant = tenant;
  req.tenantSettings = settings;
  req.tenantRole = isSuper ? 'manager' : membership.role; // super admin acts as manager
  req.tenantPermissions = permissions;
  res.locals.tenant = tenant;
  res.locals.tenantSettings = settings;
  res.locals.tenantRole = req.tenantRole;
  res.locals.tenantPermissions = permissions;
  res.locals.lang = settings.defaultLanguage;
  res.locals.adminLang = settings.defaultLanguage;
  res.locals.adminDir = isRtl(settings.defaultLanguage) ? 'rtl' : 'ltr';
  return next();
}

// Resolve a tenant for public /c/:tenantSlug/* routes (no auth needed).
export async function resolveTenantPublic(req, res, next) {
  const tenant = await getTenantBySlug(req.params.tenantSlug);
  if (!tenant || tenant.status === TENANT_STATUS.SUSPENDED) {
    return res.status(404).render('errors/404', { title: 'Not found' });
  }
  const settings = await getSettings(tenant._id);
  const supported = settings.supportedLanguages;
  const requested = req.query.lang;
  const lang = requested && supported.includes(requested) ? requested : settings.defaultLanguage;
  req.tenant = tenant;
  req.tenantSettings = settings;
  res.locals.tenant = tenant;
  res.locals.tenantSettings = settings;
  res.locals.lang = lang;
  res.locals.adminLang = lang;
  res.locals.adminDir = isRtl(lang) ? 'rtl' : 'ltr';
  return next();
}
