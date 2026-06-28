import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { randomToken } from '../lib/crypto.js';

const SALT_ROUNDS = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

export async function authenticate(email, password) {
  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user || !user.active) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

export function createInviteToken() {
  const token = randomToken(24);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return { token, expiresAt };
}

export function createResetToken() {
  const token = randomToken(24);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  return { token, expiresAt };
}

export async function setPasswordFromInvite(token, password) {
  const user = await User.findOne({ inviteToken: token, inviteExpiresAt: { $gt: new Date() } });
  if (!user) return null;
  user.passwordHash = await hashPassword(password);
  user.inviteToken = null;
  user.inviteExpiresAt = null;
  user.active = true;
  await user.save();
  return user;
}

export async function setPasswordFromReset(token, password) {
  const user = await User.findOne({ resetToken: token, resetExpiresAt: { $gt: new Date() } });
  if (!user) return null;
  user.passwordHash = await hashPassword(password);
  user.resetToken = null;
  user.resetExpiresAt = null;
  await user.save();
  return user;
}
