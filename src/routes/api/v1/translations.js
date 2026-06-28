import express from 'express';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { requireScope } from '../../../middleware/apiAuth.js';
import { aiLimiter } from '../../../middleware/rateLimiters.js';
import * as aiService from '../../../services/aiService.js';
import * as eventService from '../../../services/eventService.js';
import { getSettings } from '../../../services/tenantService.js';
import { resolveTenantLanguages } from '../../../lib/tenantLanguages.js';

const router = express.Router();

router.post(
  '/event/:id',
  requireScope('translations:write'),
  aiLimiter,
  asyncHandler(async (req, res) => {
    const event = await eventService.getEvent(req.tenant._id, req.params.id);
    if (!event) return res.status(404).json({ error: 'Not found' });

    const settings = await getSettings(req.tenant._id);
    const { supportedLanguages } = resolveTenantLanguages(settings);
    const sourceLang = req.body.sourceLang;
    if (!supportedLanguages.includes(sourceLang)) {
      return res.status(400).json({ error: 'Source language is not enabled for this calendar.' });
    }

    let targetLangs = req.body.targetLangs || [];
    if (!Array.isArray(targetLangs)) targetLangs = [targetLangs];
    targetLangs = targetLangs.filter((l) => supportedLanguages.includes(l) && l !== sourceLang);
    if (!targetLangs.length) {
      return res.status(400).json({ error: 'Provide at least one target language.' });
    }

    try {
      const results = await aiService.translateEvent({
        event,
        sourceLang,
        targetLangs,
        model: settings.aiPreferredModel,
        tenantId: req.tenant._id,
      });
      res.json({ data: results });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }),
);

export default router;
