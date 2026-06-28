import express from 'express';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { requireScope } from '../../../middleware/apiAuth.js';
import { listCategories } from '../../../services/taxonomyService.js';

const router = express.Router();

router.get(
  '/',
  requireScope('categories:read'),
  asyncHandler(async (req, res) => {
    const items = await listCategories(req.tenant._id);
    res.json({
      data: items.map((c) => ({ id: String(c._id), name: c.name, color: c.color, sortOrder: c.sortOrder })),
    });
  }),
);

export default router;
