import express from 'express';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { listForUser, markRead, markAllRead } from '../../../services/notificationService.js';

const router = express.Router({ mergeParams: true });

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await listForUser(req.user._id, { limit: 50 });
    res.render('admin/notifications', { title: 'Notifications', activeNav: 'notifications', items });
  }),
);

const readAllHandler = asyncHandler(async (req, res) => {
  await markAllRead(req.user._id);
  res.redirect(`/admin/${req.tenant.slug}/notifications`);
});

// Accept GET and POST so navigating to the URL directly does not dead-end in a
// 404; marking notifications read is idempotent and per-user.
router.get('/read-all', readAllHandler);
router.post('/read-all', readAllHandler);

const readOneHandler = asyncHandler(async (req, res) => {
  await markRead(req.user._id, req.params.id);
  res.redirect(`/admin/${req.tenant.slug}/notifications`);
});

router.get('/:id/read', readOneHandler);
router.post('/:id/read', readOneHandler);

export default router;
