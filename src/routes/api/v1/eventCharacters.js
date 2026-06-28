import express from 'express';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { requireScope } from '../../../middleware/apiAuth.js';
import { listEventCharacters } from '../../../services/taxonomyService.js';

const router = express.Router();

router.get(
  '/',
  requireScope('eventCharacters:read'),
  asyncHandler(async (req, res) => {
    const items = await listEventCharacters(req.tenant._id);
    res.json({
      data: items.map((c) => ({ id: String(c._id), name: c.name, sortOrder: c.sortOrder })),
    });
  }),
);

export default router;
