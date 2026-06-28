import express from 'express';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { requireScope } from '../../../middleware/apiAuth.js';
import { listMedia, urlForKey } from '../../../services/mediaService.js';

const router = express.Router();

router.get(
  '/',
  requireScope('images:read'),
  asyncHandler(async (req, res) => {
    const assets = await listMedia(req.tenant._id, { folder: req.query.folder, q: req.query.q });
    const data = await Promise.all(
      assets.slice(0, 100).map(async (a) => ({
        id: String(a._id),
        filename: a.filename,
        folder: a.folder,
        tags: a.tags,
        width: a.width,
        height: a.height,
        url: await urlForKey(req.tenant._id, a.s3Key),
      })),
    );
    res.json({ data });
  }),
);

export default router;
