import { doubleCsrf } from 'csrf-csrf';
import env from '../config/env.js';

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => env.sessionSecret,
  getSessionIdentifier: (req) => req.session?.id || '',
  cookieName: env.isProd ? '__Host-csrf' : 'csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: '/',
  },
  size: 64,
  getCsrfTokenFromRequest: (req) => req.body?._csrf || req.headers['x-csrf-token'],
});

// Apply CSRF protection but skip the JSON REST API (token-authenticated, stateless).
export function csrfProtection(req, res, next) {
  if (req.path.startsWith('/api/')) return next();
  return doubleCsrfProtection(req, res, next);
}

// Expose a token generator to views.
export function csrfToken(req, res, next) {
  if (!req.path.startsWith('/api/')) {
    try {
      res.locals.csrfToken = generateCsrfToken(req, res);
    } catch {
      res.locals.csrfToken = '';
    }
  }
  next();
}
