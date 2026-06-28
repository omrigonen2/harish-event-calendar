import { TENANT_PERMISSIONS, TENANT_PERMISSION_KEYS, TENANT_ROLES } from '../config/constants.js';

const { EVENTS_WRITE, EVENTS_PUBLISH, EVENTS_SCOPE_ALL, AI_MARKETING, TENANT_MANAGE } =
  TENANT_PERMISSIONS;

function emptyPermissions() {
  return TENANT_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});
}

export function fullManagerPermissions() {
  return TENANT_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});
}

export function editorDefaultPermissions() {
  return { ...emptyPermissions(), [EVENTS_WRITE]: true };
}

// Derive permissions from the legacy single-role field (migration helper).
export function permissionsFromRole(role) {
  return role === TENANT_ROLES.MANAGER ? fullManagerPermissions() : editorDefaultPermissions();
}

// Coerce arbitrary input into a complete, consistent permission set.
// `tenantManage` is the superset and forces all other flags on.
export function normalizePermissions(input = {}) {
  const out = emptyPermissions();
  for (const key of TENANT_PERMISSION_KEYS) {
    out[key] = input[key] === true || input[key] === 'on' || input[key] === 'true';
  }
  if (out[TENANT_MANAGE]) {
    return fullManagerPermissions();
  }
  return out;
}

// Resolve effective permissions for a request, accounting for super admins.
export function effectivePermissions(req) {
  if (req.user?.platformRole) return fullManagerPermissions();
  return normalizePermissions(req.tenantPermissions || {});
}

export function isManager(permissions) {
  return Boolean(permissions?.[TENANT_MANAGE]);
}

// Event/media visibility scope: null = all tenant records, userId = own only.
export function eventScope(req) {
  if (req.user?.platformRole) return null;
  const perms = req.tenantPermissions || {};
  if (perms[TENANT_MANAGE] || perms[EVENTS_SCOPE_ALL]) return null;
  return req.user._id;
}

export function hasPermission(req, key) {
  if (req.user?.platformRole) return true;
  const perms = req.tenantPermissions || {};
  if (perms[TENANT_MANAGE]) return true;
  return Boolean(perms[key]);
}

export {
  EVENTS_WRITE,
  EVENTS_PUBLISH,
  EVENTS_SCOPE_ALL,
  AI_MARKETING,
  TENANT_MANAGE,
};
