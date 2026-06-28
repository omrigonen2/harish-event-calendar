import { PLATFORM_ROLES } from '../config/constants.js';

export function requireAuth(req, res, next) {
  if (!req.user) {
    req.flash('error', 'Please sign in to continue.');
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  return next();
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.platformRole !== PLATFORM_ROLES.SUPER_ADMIN) {
    return res.status(403).render('errors/403', { title: 'Forbidden' });
  }
  return next();
}
