import { TENANT_PERMISSIONS } from '../config/constants.js';
import { hasPermission, eventScope } from '../lib/permissions.js';

// Require at least one of the given permissions for the tenant.
// Super admins always pass; `tenantManage` implies every permission.
export function requirePermission(...keys) {
  return (req, res, next) => {
    if (keys.some((key) => hasPermission(req, key))) {
      return next();
    }
    return res.status(403).render('errors/403', { title: 'Forbidden' });
  };
}

// Require full manager access (the `tenantManage` superset).
export const requireManager = requirePermission(TENANT_PERMISSIONS.TENANT_MANAGE);

// Returns the createdBy scope to apply: full access => null, own-only => userId.
export { eventScope };

// Backward-compatible alias for the legacy name.
export const editorScope = eventScope;
