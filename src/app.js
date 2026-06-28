import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import ejsMate from 'ejs-mate';

import env from './config/env.js';
import { sessionMiddleware } from './middleware/session.js';
import { flashMiddleware } from './middleware/flash.js';
import { currentUser } from './middleware/currentUser.js';
import { csrfProtection, csrfToken } from './middleware/csrf.js';
import { viewHelpers } from './lib/helpers.js';
import { translate } from './lib/ui-i18n.js';
import { asyncHandler } from './lib/asyncHandler.js';
import { getTenantById } from './services/tenantService.js';

import healthRoutes from './routes/web/health.js';
import authRoutes from './routes/web/auth.js';
import platformRoutes from './routes/web/platform.js';
import adminRoutes from './routes/web/admin/index.js';
import publicRoutes from './routes/web/public.js';
import shareRoutes from './routes/web/share.js';
import apiRoutes from './routes/api/v1/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.engine('ejs', ejsMate);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false, // relaxed for inline EJS + CDN calendar assets
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser(env.sessionSecret));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Health check has no session/CSRF dependencies.
  app.use('/', healthRoutes);
  app.use('/', shareRoutes);

  // REST API: stateless, token-authenticated, mounted before session/CSRF web stack.
  app.use('/api/v1', apiRoutes);

  app.use(sessionMiddleware());
  app.use(flashMiddleware);
  app.use(currentUser);
  app.use(csrfProtection);
  app.use(csrfToken);
  app.use(viewHelpers);

  app.use('/', authRoutes);
  app.use('/platform', platformRoutes);
  app.use('/admin/:tenantSlug', adminRoutes);
  app.use('/c/:tenantSlug', publicRoutes);

  app.get('/', asyncHandler(async (req, res) => {
    if (!req.user) return res.redirect('/login');
    if (req.user.platformRole) return res.redirect('/platform/tenants');
    const membership = req.user.tenantMemberships.find((m) => m.active);
    if (!membership) return res.redirect('/login');
    const tenant = await getTenantById(membership.tenantId);
    if (!tenant) return res.redirect('/login');
    return res.redirect(`/admin/${tenant.slug}/dashboard`);
  }));

  // 404
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(404).render('errors/404', { title: 'Not found' });
  });

  // Error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (req.path.startsWith('/api/')) {
      return res.status(status).json({ error: err.message || 'Server error' });
    }
    if (err.code === 'EBADCSRFTOKEN' || err.code === 'ERR_BAD_CSRF_TOKEN') {
      // A stale/missing CSRF token (e.g. cookies left over from a previous server
      // instance) should not dead-end the user. Bounce back to the form with a
      // fresh token so a simple retry succeeds.
      if (req.flash) {
        req.flash('error', translate('auth.csrfExpired', res.locals.adminLang || 'he'));
      }
      const back = req.get('referer');
      const target = back && back.startsWith(req.protocol) ? back : '/login';
      return res.redirect(303, target);
    }
    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
    return res.status(status).render('errors/500', { title: 'Error', message: err.message, status });
  });

  return app;
}
