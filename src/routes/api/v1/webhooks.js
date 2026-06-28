import express from 'express';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import ApiToken from '../../../models/ApiToken.js';

const router = express.Router();

// Webhook registration stub: stores a webhook URL on the calling token.
// Event delivery is a future-roadmap item; this records intent for now.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ data: { webhookUrl: req.apiToken.webhookUrl || null } });
  }),
);

router.put(
  '/',
  asyncHandler(async (req, res) => {
    await ApiToken.updateOne({ _id: req.apiToken._id }, { webhookUrl: req.body.webhookUrl || '' });
    res.json({ data: { webhookUrl: req.body.webhookUrl || '' }, note: 'Webhook delivery is not yet active (roadmap).' });
  }),
);

export default router;
