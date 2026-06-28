import express from 'express';
import { apiAuth } from '../../../middleware/apiAuth.js';
import { apiLimiter } from '../../../middleware/rateLimiters.js';

import eventsRoutes from './events.js';
import categoriesRoutes from './categories.js';
import audiencesRoutes from './audiences.js';
import eventCharactersRoutes from './eventCharacters.js';
import usersRoutes from './users.js';
import imagesRoutes from './images.js';
import translationsRoutes from './translations.js';
import calendarRoutes from './calendar.js';
import webhooksRoutes from './webhooks.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    name: 'City Events Calendar API',
    version: 'v1',
    docs: '/api/v1 endpoints require a Bearer token created in tenant settings.',
  });
});

router.use(apiAuth, apiLimiter);

router.use('/events', eventsRoutes);
router.use('/categories', categoriesRoutes);
router.use('/audiences', audiencesRoutes);
router.use('/event-characters', eventCharactersRoutes);
router.use('/users', usersRoutes);
router.use('/images', imagesRoutes);
router.use('/translations', translationsRoutes);
router.use('/calendar', calendarRoutes);
router.use('/webhooks', webhooksRoutes);

export default router;
