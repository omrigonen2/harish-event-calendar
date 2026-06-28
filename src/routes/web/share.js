import express from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { resolveShareLink, buildFilteredCalendarPath } from '../../lib/calendarLink.js';
import { getTenantById } from '../../services/tenantService.js';
import { TENANT_STATUS } from '../../config/constants.js';
const router = express.Router();

router.get(
  '/s/:code',
  asyncHandler(async (req, res) => {
    const link = await resolveShareLink(req.params.code);
    if (!link) return res.status(404).render('errors/404', { title: 'Not found' });

    const tenant = await getTenantById(link.tenantId);
    if (!tenant || tenant.status === TENANT_STATUS.SUSPENDED) {
      return res.status(404).render('errors/404', { title: 'Not found' });
    }

    res.redirect(302, buildFilteredCalendarPath(tenant.slug, link.filters, { share: true }));
  }),
);

export default router;
