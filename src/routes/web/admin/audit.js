import express from 'express';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { requireManager } from '../../../middleware/requireRole.js';
import { listAudit } from '../../../services/auditService.js';

const router = express.Router({ mergeParams: true });

router.use(requireManager);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { items, total } = await listAudit({
      tenantId: req.tenant._id,
      action: req.query.action,
      limit: 200,
    });
    res.render('admin/audit', {
      title: 'Audit Log',
      activeNav: 'audit',
      items,
      total,
      action: req.query.action || '',
    });
  }),
);

export default router;
