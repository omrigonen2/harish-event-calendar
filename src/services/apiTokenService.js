import ApiToken from '../models/ApiToken.js';
import { randomToken, sha256Hex } from '../lib/crypto.js';

export async function listTokens(tenantId) {
  return ApiToken.find({ tenantId }).sort({ createdAt: -1 }).lean();
}

export async function createToken(tenantId, userId, { name, scopes = [], webhookUrl = '' }) {
  const raw = `ect_${randomToken(24)}`;
  const token = await ApiToken.create({
    tenantId,
    name,
    tokenHash: sha256Hex(Buffer.from(raw)),
    prefix: raw.slice(0, 10),
    scopes,
    webhookUrl,
    createdBy: userId,
  });
  return { token, raw };
}

export async function revokeToken(tenantId, id) {
  return ApiToken.findOneAndUpdate({ _id: id, tenantId }, { revoked: true }, { new: true });
}

// Resolve a raw bearer token to its (active) ApiToken document.
export async function resolveToken(rawToken) {
  if (!rawToken) return null;
  const hash = sha256Hex(Buffer.from(rawToken));
  const token = await ApiToken.findOne({ tokenHash: hash, revoked: false });
  if (!token) return null;
  token.lastUsedAt = new Date();
  await token.save();
  return token;
}
