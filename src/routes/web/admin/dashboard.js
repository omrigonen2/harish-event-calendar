import express from 'express';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { editorScope } from '../../../middleware/requireRole.js';
import { getDashboard } from '../../../services/dashboardService.js';

const router = express.Router({ mergeParams: true });

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await getDashboard(req.tenant, req.tenantSettings, editorScope(req));
    res.render('admin/dashboard', { title: 'Dashboard', data, activeNav: 'dashboard' });
  }),
);
export default router;
