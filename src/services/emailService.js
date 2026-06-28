import { sendEmail, templates } from '../lib/resend.js';
import { getResendConfig } from './settingsService.js';

export { templates };

export async function send({ to, subject, html, text, tenantId = null }) {
  const config = await getResendConfig(tenantId);
  return sendEmail(config, { to, subject, html, text });
}

export async function sendTemplate(to, template, tenantId = null) {
  return send({ to, subject: template.subject, html: template.html, text: template.text, tenantId });
}

export async function trySend({ to, subject, html, text, tenantId = null }) {
  try {
    await send({ to, subject, html, text, tenantId });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
