import Notification from '../models/Notification.js';
import { trySend } from './emailService.js';

/**
 * Create an in-app notification and optionally deliver it by email.
 * Email failures are recorded on the notification for later retry rather than thrown.
 */
export async function notify({
  userId,
  tenantId = null,
  type,
  title,
  body = '',
  link = '',
  email = null, // { to, html, text } when an email should also be sent
}) {
  const doc = await Notification.create({
    userId,
    tenantId,
    type,
    title,
    body,
    link,
    emailRequested: Boolean(email),
  });

  if (email) {
    const result = await trySend({
      to: email.to,
      subject: email.subject || title,
      html: email.html,
      text: email.text,
      tenantId,
    });
    doc.emailAttempts += 1;
    if (result.ok) {
      doc.emailSentAt = new Date();
    } else {
      doc.emailError = result.error || 'unknown error';
    }
    await doc.save();
  }

  return doc;
}

export async function listForUser(userId, { unreadOnly = false, limit = 20 } = {}) {
  const query = { userId };
  if (unreadOnly) query.readAt = null;
  return Notification.find(query).sort({ createdAt: -1 }).limit(limit).lean();
}

export async function unreadCount(userId) {
  return Notification.countDocuments({ userId, readAt: null });
}

export async function markRead(userId, notificationId) {
  return Notification.updateOne(
    { _id: notificationId, userId },
    { $set: { readAt: new Date() } },
  );
}

export async function markAllRead(userId) {
  return Notification.updateMany(
    { userId, readAt: null },
    { $set: { readAt: new Date() } },
  );
}
