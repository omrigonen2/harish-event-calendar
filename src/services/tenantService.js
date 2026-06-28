import Tenant from '../models/Tenant.js';
import TenantSettings from '../models/TenantSettings.js';
import { TENANT_STATUS } from '../config/constants.js';
import { applyTenantLanguages } from '../lib/tenantLanguages.js';

function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export async function listTenants() {
  return Tenant.find().sort({ createdAt: -1 }).lean();
}

export async function getTenantBySlug(slug) {
  return Tenant.findOne({ slug: String(slug).toLowerCase() });
}

export async function getTenantById(id) {
  return Tenant.findById(id);
}

export async function getSettings(tenantId) {
  let settings = await TenantSettings.findOne({ tenantId });
  if (!settings) {
    settings = await TenantSettings.create({ tenantId });
  }
  return applyTenantLanguages(settings);
}

export async function createTenant({ name, slug }) {
  let finalSlug = slugify(slug || name);
  if (!finalSlug) {
    throw new Error('A valid name or slug is required');
  }
  const existing = await Tenant.findOne({ slug: finalSlug });
  if (existing) {
    finalSlug = `${finalSlug}-${Date.now().toString(36).slice(-4)}`;
  }
  const tenant = await Tenant.create({ name, slug: finalSlug });
  await TenantSettings.create({ tenantId: tenant._id });
  return tenant;
}

export async function setStatus(tenantId, status) {
  const valid = Object.values(TENANT_STATUS);
  if (!valid.includes(status)) throw new Error('Invalid status');
  return Tenant.findByIdAndUpdate(tenantId, { status }, { new: true });
}

export async function updateSettings(tenantId, values) {
  const settings = await getSettings(tenantId);
  Object.assign(settings, values);
  await settings.save();
  return settings;
}
