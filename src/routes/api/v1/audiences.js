import express from 'express';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { requireScope } from '../../../middleware/apiAuth.js';
import { listAudiences } from '../../../services/taxonomyService.js';

const router = express.Router();

router.get(
  '/',
  requireScope('audiences:read'),
  asyncHandler(async (req, res) => {
    const items = await listAudiences(req.tenant._id);
    res.json({ data: items.map((a) => ({ id: String(a._id), name: a.name, sortOrder: a.sortOrder })) });
  }),
);

export default router;
