import express from 'express';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { requireManager } from '../../../middleware/requireRole.js';
import {
  listTenantUsers,
  inviteUser,
  setMembershipPermissions,
  setMembershipActive,
  issueResetTokenForUser,
  countActiveManagers,
} from '../../../services/userService.js';
import { notify } from '../../../services/notificationService.js';
import { sendTemplate, templates } from '../../../services/emailService.js';
import { audit } from '../../../services/auditService.js';
import { AUDIT_ACTIONS, NOTIFICATION_TYPES, TENANT_PERMISSIONS } from '../../../config/constants.js';
import { normalizePermissions, isManager } from '../../../lib/permissions.js';
import env from '../../../config/env.js';
import { translate } from '../../../lib/ui-i18n.js';

const router = express.Router({ mergeParams: true });

function lang(req) {
  return req.tenantSettings.defaultLanguage;
}

router.use(requireManager);

function base(req) {
  return `/admin/${req.tenant.slug}`;
}

function permissionsFromBody(body) {
  return normalizePermissions({
    [TENANT_PERMISSIONS.EVENTS_WRITE]: body[TENANT_PERMISSIONS.EVENTS_WRITE],
    [TENANT_PERMISSIONS.EVENTS_PUBLISH]: body[TENANT_PERMISSIONS.EVENTS_PUBLISH],
    [TENANT_PERMISSIONS.EVENTS_SCOPE_ALL]: body[TENANT_PERMISSIONS.EVENTS_SCOPE_ALL],
    [TENANT_PERMISSIONS.AI_MARKETING]: body[TENANT_PERMISSIONS.AI_MARKETING],
    [TENANT_PERMISSIONS.TENANT_MANAGE]: body[TENANT_PERMISSIONS.TENANT_MANAGE],
  });
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const users = await listTenantUsers(req.tenant._id);
    res.render('admin/users', { title: 'Users', activeNav: 'users', users, tenantId: req.tenant._id });
  }),
);

router.post(
  '/invite',
  asyncHandler(async (req, res) => {
    const permissions = permissionsFromBody(req.body);
    const role = isManager(permissions) ? 'manager' : 'editor';
    const { user, inviteToken } = await inviteUser(req.tenant._id, {
      email: req.body.email,
      name: req.body.name,
      permissions,
    });

    if (inviteToken) {
      const inviteUrl = `${env.appBaseUrl}/invite/${inviteToken}`;
      await notify({
        userId: user._id,
        tenantId: req.tenant._id,
        type: NOTIFICATION_TYPES.USER_INVITED,
        title: 'You were invited',
        body: `Invited to ${req.tenant.name}`,
        email: {
          to: user.email,
          ...templates.invite({ tenantName: req.tenant.name, inviteUrl, role }),
        },
      });
    }

    await audit({
      tenantId: req.tenant._id,
      actor: req.user,
      action: AUDIT_ACTIONS.USER_INVITED,
      entityType: 'user',
      entityId: user._id,
      metadata: { email: user.email, permissions },
    });
    req.flash('success', inviteToken
      ? translate('flash.inviteSent', lang(req), { email: user.email })
      : translate('flash.userAdded', lang(req), { email: user.email }));
    res.redirect(`${base(req)}/users`);
  }),
);

router.post(
  '/:userId/role',
  asyncHandler(async (req, res) => {
    const permissions = permissionsFromBody(req.body);
    // Block demoting the last remaining manager.
    if (!isManager(permissions)) {
      const remaining = await countActiveManagers(req.tenant._id, req.params.userId);
      if (remaining === 0) {
        req.flash('error', translate('flash.lastManager', lang(req)));
        return res.redirect(`${base(req)}/users`);
      }
    }
    await setMembershipPermissions(req.tenant._id, req.params.userId, permissions);
    await audit({ tenantId: req.tenant._id, actor: req.user, action: AUDIT_ACTIONS.USER_UPDATED, entityType: 'user', entityId: req.params.userId, metadata: { permissions } });
    req.flash('success', translate('flash.roleUpdated', lang(req)));
    res.redirect(`${base(req)}/users`);
  }),
);

router.post(
  '/:userId/active',
  asyncHandler(async (req, res) => {
    const active = req.body.active === 'true';
    // Block deactivating the last remaining manager.
    if (!active) {
      const remaining = await countActiveManagers(req.tenant._id, req.params.userId);
      if (remaining === 0) {
        req.flash('error', translate('flash.lastManager', lang(req)));
        return res.redirect(`${base(req)}/users`);
      }
    }
    await setMembershipActive(req.tenant._id, req.params.userId, active);
    await audit({ tenantId: req.tenant._id, actor: req.user, action: AUDIT_ACTIONS.USER_UPDATED, entityType: 'user', entityId: req.params.userId, metadata: { active } });
    req.flash('success', active ? translate('flash.userActivated', lang(req)) : translate('flash.userDeactivated', lang(req)));
    res.redirect(`${base(req)}/users`);
  }),
);

router.post(
  '/:userId/reset',
  asyncHandler(async (req, res) => {
    const result = await issueResetTokenForUser(req.params.userId);
    if (result) {
      const resetUrl = `${env.appBaseUrl}/reset/${result.token}`;
      try {
        await sendTemplate(result.user.email, templates.passwordReset({ resetUrl }), req.tenant._id);
        req.flash('success', translate('flash.resetSent', lang(req), { email: result.user.email }));
      } catch (err) {
        req.flash('error', translate('flash.resetFailed', lang(req), { message: err.message }));
      }
    }
    res.redirect(`${base(req)}/users`);
  }),
);

export default router;
