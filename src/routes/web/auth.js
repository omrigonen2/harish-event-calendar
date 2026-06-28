import express from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { loginLimiter } from '../../middleware/rateLimiters.js';
import {
  authenticate,
  setPasswordFromInvite,
  setPasswordFromReset,
} from '../../services/authService.js';
import { issueResetToken } from '../../services/userService.js';
import { sendTemplate, templates } from '../../services/emailService.js';
import env from '../../config/env.js';
import User from '../../models/User.js';
import { translate } from '../../lib/ui-i18n.js';
import { DEFAULT_LANGUAGE } from '../../config/constants.js';

const L = DEFAULT_LANGUAGE;

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/login', { title: translate('auth.signIn', L), next: req.query.next || '' });
});

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await authenticate(email, password);
    if (!user) {
      req.flash('error', translate('flash.invalidLogin', L));
      return res.redirect('/login');
    }
    req.session.userId = user._id.toString();
    const next = req.body.next;
    if (next && next.startsWith('/')) return res.redirect(next);
    return res.redirect('/');
  }),
);

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// Accept invitation: set password.
router.get(
  '/invite/:token',
  asyncHandler(async (req, res) => {
    const user = await User.findOne({
      inviteToken: req.params.token,
      inviteExpiresAt: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).render('auth/token-invalid', { title: 'Invalid invitation' });
    }
    res.render('auth/set-password', {
      title: translate('auth.setPassword', L),
      action: `/invite/${req.params.token}`,
      heading: translate('auth.setPassword', L),
    });
  }),
);

router.post(
  '/invite/:token',
  asyncHandler(async (req, res) => {
    const { password, confirm } = req.body;
    if (!password || password.length < 8 || password !== confirm) {
      req.flash('error', translate('flash.passwordMismatch', L));
      return res.redirect(`/invite/${req.params.token}`);
    }
    const user = await setPasswordFromInvite(req.params.token, password);
    if (!user) {
      return res.status(400).render('auth/token-invalid', { title: 'Invalid invitation' });
    }
    req.session.userId = user._id.toString();
    req.flash('success', translate('flash.accountReady', L));
    return res.redirect('/');
  }),
);

// Forgot password.
router.get('/forgot', (req, res) => {
  res.render('auth/forgot', { title: translate('auth.forgotTitle', L) });
});

router.post(
  '/forgot',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const result = await issueResetToken(req.body.email);
    if (result) {
      const resetUrl = `${env.appBaseUrl}/reset/${result.token}`;
      try {
        await sendTemplate(result.user.email, templates.passwordReset({ resetUrl }));
      } catch {
        // Don't reveal delivery failures to avoid user enumeration.
      }
    }
    req.flash('success', translate('flash.resetEmailSent', L));
    return res.redirect('/login');
  }),
);

router.get(
  '/reset/:token',
  asyncHandler(async (req, res) => {
    const user = await User.findOne({
      resetToken: req.params.token,
      resetExpiresAt: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).render('auth/token-invalid', { title: 'Invalid link' });
    }
    res.render('auth/set-password', {
      title: translate('auth.setPassword', L),
      action: `/reset/${req.params.token}`,
      heading: translate('auth.setPassword', L),
    });
  }),
);

router.post(
  '/reset/:token',
  asyncHandler(async (req, res) => {
    const { password, confirm } = req.body;
    if (!password || password.length < 8 || password !== confirm) {
      req.flash('error', translate('flash.passwordMismatch', L));
      return res.redirect(`/reset/${req.params.token}`);
    }
    const user = await setPasswordFromReset(req.params.token, password);
    if (!user) {
      return res.status(400).render('auth/token-invalid', { title: 'Invalid link' });
    }
    req.flash('success', translate('flash.passwordUpdated', L));
    return res.redirect('/login');
  }),
);

export default router;
