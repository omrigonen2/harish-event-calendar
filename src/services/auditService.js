import AuditLog from '../models/AuditLog.js';

export async function audit({ tenantId = null, actor = null, action, entityType = '', entityId = null, metadata = {} }) {
  try {
    await AuditLog.create({
      tenantId,
      actorId: actor?._id || null,
      actorEmail: actor?.email || '',
      action,
      entityType,
      entityId,
      metadata,
    });
  } catch {
    // Audit logging must never break the main flow.
  }
}

export async function listAudit({ tenantId, action, limit = 100, skip = 0 }) {
  const query = {};
  if (tenantId !== undefined) query.tenantId = tenantId;
  if (action) query.action = action;
  const [items, total] = await Promise.all([
    AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(query),
  ]);
  return { items, total };
}
