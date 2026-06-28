import { resolveToken } from '../services/apiTokenService.js';
import { getTenantById } from '../services/tenantService.js';
import { TENANT_STATUS } from '../config/constants.js';

// Bearer-token auth for the REST API. Resolves the token's tenant and scopes.
export async function apiAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const raw = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!raw) return res.status(401).json({ error: 'Missing bearer token' });

    const token = await resolveToken(raw);
    if (!token) return res.status(401).json({ error: 'Invalid or revoked token' });

    const tenant = await getTenantById(token.tenantId);
    if (!tenant || tenant.status === TENANT_STATUS.SUSPENDED) {
      return res.status(403).json({ error: 'Tenant unavailable' });
    }

    req.apiToken = token;
    req.tenant = tenant;
    return next();
  } catch (err) {
    return next(err);
  }
}

// Require a scope on the resolved token.
export function requireScope(scope) {
  return (req, res, next) => {
    if (!req.apiToken?.scopes?.includes(scope)) {
      return res.status(403).json({ error: `Missing scope: ${scope}` });
    }
    return next();
  };
}
