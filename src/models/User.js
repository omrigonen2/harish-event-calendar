import mongoose from '../lib/db.js';
import { PLATFORM_ROLES, TENANT_ROLES } from '../config/constants.js';
import { permissionsFromRole, normalizePermissions } from '../lib/permissions.js';

const { Schema } = mongoose;

const permissionsSchema = new Schema(
  {
    eventsWrite: { type: Boolean, default: false },
    eventsPublish: { type: Boolean, default: false },
    eventsScopeAll: { type: Boolean, default: false },
    aiMarketing: { type: Boolean, default: false },
    tenantManage: { type: Boolean, default: false },
  },
  { _id: false },
);

const membershipSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    role: { type: String, enum: Object.values(TENANT_ROLES), required: true },
    permissions: { type: permissionsSchema, default: undefined },
    active: { type: Boolean, default: true },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, default: '' },
    passwordHash: { type: String, default: '' },
    platformRole: { type: String, enum: [PLATFORM_ROLES.SUPER_ADMIN], default: undefined },
    tenantMemberships: { type: [membershipSchema], default: [] },
    active: { type: Boolean, default: true },
    inviteToken: { type: String, default: null },
    inviteExpiresAt: { type: Date, default: null },
    resetToken: { type: String, default: null },
    resetExpiresAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.methods.membershipFor = function membershipFor(tenantId) {
  return this.tenantMemberships.find(
    (m) => String(m.tenantId) === String(tenantId) && m.active,
  );
};

// Resolve normalized permissions for a tenant, deriving from legacy `role`
// when an explicit permission set has not been stored yet.
userSchema.methods.permissionsFor = function permissionsFor(tenantId) {
  const membership = this.tenantMemberships.find(
    (m) => String(m.tenantId) === String(tenantId),
  );
  if (!membership) return null;
  if (membership.permissions) {
    return normalizePermissions(membership.permissions.toObject
      ? membership.permissions.toObject()
      : membership.permissions);
  }
  return permissionsFromRole(membership.role);
};

export default mongoose.model('User', userSchema);
