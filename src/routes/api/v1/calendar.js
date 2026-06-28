import express from 'express';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { requireScope } from '../../../middleware/apiAuth.js';
import { getSettings } from '../../../services/tenantService.js';

const router = express.Router();

// Read-only calendar/tenant settings.
router.get(
  '/',
  requireScope('calendar:read'),
  asyncHandler(async (req, res) => {
    const settings = await getSettings(req.tenant._id);
    res.json({
      data: {
        name: req.tenant.name,
        slug: req.tenant.slug,
        description: settings.description,
        defaultLanguage: settings.defaultLanguage,
        supportedLanguages: settings.supportedLanguages,
        timezone: settings.timezone,
        dateFormat: settings.dateFormat,
        colors: settings.colors,
      },
    });
  }),
);

export default router;
