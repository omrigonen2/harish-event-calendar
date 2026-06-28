import express from 'express';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { requireScope } from '../../../middleware/apiAuth.js';
import { listTenantUsers } from '../../../services/userService.js';
import { permissionsFromRole } from '../../../lib/permissions.js';

const router = express.Router();

router.get(
  '/',
  requireScope('users:read'),
  asyncHandler(async (req, res) => {
    const users = await listTenantUsers(req.tenant._id);
    const data = users.map((u) => {
      const membership = u.tenantMemberships.find((m) => String(m.tenantId) === String(req.tenant._id));
      return {
        id: String(u._id),
        email: u.email,
        name: u.name,
        role: membership?.role,
        permissions: membership?.permissions || permissionsFromRole(membership?.role),
        active: membership?.active,
      };
    });
    res.json({ data });
  }),
);

export default router;
