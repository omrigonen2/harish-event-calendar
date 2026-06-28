import User from '../models/User.js';
import { createInviteToken, createResetToken, hashPassword } from './authService.js';
import { normalizePermissions, isManager } from '../lib/permissions.js';
import { TENANT_ROLES, TENANT_PERMISSIONS } from '../config/constants.js';

export async function listTenantUsers(tenantId) {
  return User.find({ 'tenantMemberships.tenantId': tenantId }).sort({ createdAt: -1 }).lean();
}

export async function getById(id) {
  return User.findById(id);
}

// Legacy `role` is kept in sync with permissions for backward compatibility.
function roleForPermissions(permissions) {
  return isManager(permissions) ? TENANT_ROLES.MANAGER : TENANT_ROLES.EDITOR;
}

// Count active managers (full tenantManage permission) in a tenant, optionally
// excluding one user. Used to protect against removing the last manager.
export async function countActiveManagers(tenantId, excludeUserId = null) {
  const users = await User.find({
    'tenantMemberships.tenantId': tenantId,
  }).lean();
  return users.filter((u) => {
    if (excludeUserId && String(u._id) === String(excludeUserId)) return false;
    const m = u.tenantMemberships.find((x) => String(x.tenantId) === String(tenantId));
    if (!m || !m.active) return false;
    const perms = m.permissions || { tenantManage: m.role === TENANT_ROLES.MANAGER };
    return perms[TENANT_PERMISSIONS.TENANT_MANAGE] === true;
  }).length;
}

// Invite (or attach) a user to a tenant with a permission set. Returns { user, inviteToken }.
export async function inviteUser(tenantId, { email, name, permissions }) {
  const normalized = String(email).toLowerCase().trim();
  const perms = normalizePermissions(permissions);
  const role = roleForPermissions(perms);
  let user = await User.findOne({ email: normalized });
  const { token, expiresAt } = createInviteToken();

  if (user) {
    const existing = user.membershipFor(tenantId);
    if (existing) {
      existing.role = role;
      existing.permissions = perms;
      existing.active = true;
    } else {
      user.tenantMemberships.push({ tenantId, role, permissions: perms, active: true });
    }
    // Only (re)issue an invite token if the user has not set a password yet.
    if (!user.passwordHash) {
      user.inviteToken = token;
      user.inviteExpiresAt = expiresAt;
    }
    await user.save();
    return { user, inviteToken: user.passwordHash ? null : token };
  }

  user = await User.create({
    email: normalized,
    name: name || '',
    active: false,
    inviteToken: token,
    inviteExpiresAt: expiresAt,
    tenantMemberships: [{ tenantId, role, permissions: perms, active: true }],
  });
  return { user, inviteToken: token };
}

// Directly add a user with a password (super admin flow, no invite email).
export async function addUserDirect(tenantId, { email, name, password, permissions }) {
  const normalized = String(email).toLowerCase().trim();
  const perms = normalizePermissions(permissions);
  const role = roleForPermissions(perms);
  const passwordHash = await hashPassword(password);
  let user = await User.findOne({ email: normalized });

  if (user) {
    const existing = user.membershipFor(tenantId);
    if (existing) {
      existing.role = role;
      existing.permissions = perms;
      existing.active = true;
    } else {
      user.tenantMemberships.push({ tenantId, role, permissions: perms, active: true });
    }
    user.name = name || user.name;
    user.passwordHash = passwordHash;
    user.active = true;
    user.inviteToken = null;
    user.inviteExpiresAt = null;
    await user.save();
    return user;
  }

  user = await User.create({
    email: normalized,
    name: name || '',
    passwordHash,
    active: true,
    tenantMemberships: [{ tenantId, role, permissions: perms, active: true }],
  });
  return user;
}

export async function setMembershipPermissions(tenantId, userId, permissions) {
  const user = await User.findById(userId);
  if (!user) return null;
  const m = user.tenantMemberships.find((x) => String(x.tenantId) === String(tenantId));
  if (!m) return null;
  const perms = normalizePermissions(permissions);
  m.permissions = perms;
  m.role = roleForPermissions(perms);
  await user.save();
  return user;
}

export async function setMembershipActive(tenantId, userId, active) {
  const user = await User.findById(userId);
  if (!user) return null;
  const m = user.tenantMemberships.find((x) => String(x.tenantId) === String(tenantId));
  if (!m) return null;
  m.active = active;
  await user.save();
  return user;
}

export async function issueResetToken(email) {
  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) return null;
  const { token, expiresAt } = createResetToken();
  user.resetToken = token;
  user.resetExpiresAt = expiresAt;
  await user.save();
  return { user, token };
}

export async function issueResetTokenForUser(userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  const { token, expiresAt } = createResetToken();
  user.resetToken = token;
  user.resetExpiresAt = expiresAt;
  await user.save();
  return { user, token };
}
