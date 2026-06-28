import express from 'express';
import { requireAuth } from '../../../middleware/requireAuth.js';
import { resolveTenantAdmin } from '../../../middleware/resolveTenant.js';

import dashboardRoutes from './dashboard.js';
import eventsRoutes from './events.js';
import taxonomyRoutes from './taxonomy.js';
import usersRoutes from './users.js';
import mediaRoutes from './media.js';
import settingsRoutes from './settings.js';
import aiRoutes from './ai.js';
import auditRoutes from './audit.js';
import notificationsRoutes from './notifications.js';

const router = express.Router({ mergeParams: true });

router.use(requireAuth, resolveTenantAdmin);

router.use('/dashboard', dashboardRoutes);
router.use('/events', eventsRoutes);
router.use('/users', usersRoutes);
router.use('/media', mediaRoutes);
router.use('/settings', settingsRoutes);
router.use('/ai', aiRoutes);
router.use('/audit', auditRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/', taxonomyRoutes);

router.get('/', (req, res) => res.redirect(`/admin/${req.tenant.slug}/dashboard`));

export default router;
