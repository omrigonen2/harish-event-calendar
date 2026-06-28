import { Resend } from 'resend';

export function buildResendClient(config) {
  if (!config || !config.apiKey) {
    throw new Error('Resend email is not configured. Set it in Platform Settings.');
  }
  return new Resend(config.apiKey);
}

export async function sendEmail(config, { to, subject, html, text }) {
  const client = buildResendClient(config);
  const from = config.fromName
    ? `${config.fromName} <${config.fromEmail}>`
    : config.fromEmail;
  const result = await client.emails.send({ from, to, subject, html, text });
  if (result.error) {
    throw new Error(result.error.message || 'Resend send failed');
  }
  return result.data;
}

function baseTemplate(title, bodyHtml) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<div style="max-width:560px;margin:0 auto;padding:24px;">
  <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e6e8eb;">
    <h1 style="font-size:20px;margin:0 0 16px;">${title}</h1>
    ${bodyHtml}
  </div>
  <p style="color:#8a8f98;font-size:12px;text-align:center;margin-top:16px;">City Events Calendar Platform</p>
</div>
</body></html>`;
}

function button(label, url) {
  return `<a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">${label}</a>`;
}

export const templates = {
  invite({ tenantName, inviteUrl, role }) {
    return {
      subject: `You have been invited to ${tenantName}`,
      html: baseTemplate(
        `You're invited to ${tenantName}`,
        `<p>You have been invited as a <strong>${role}</strong> on the ${tenantName} events calendar.</p>
         <p>Click below to set your password and get started.</p>
         <p style="margin:24px 0;">${button('Accept invitation', inviteUrl)}</p>
         <p style="color:#8a8f98;font-size:13px;">If you did not expect this, you can ignore this email.</p>`,
      ),
      text: `You have been invited as a ${role} on ${tenantName}. Accept: ${inviteUrl}`,
    };
  },
  passwordReset({ resetUrl }) {
    return {
      subject: 'Reset your password',
      html: baseTemplate(
        'Reset your password',
        `<p>We received a request to reset your password.</p>
         <p style="margin:24px 0;">${button('Reset password', resetUrl)}</p>
         <p style="color:#8a8f98;font-size:13px;">If you did not request this, ignore this email.</p>`,
      ),
      text: `Reset your password: ${resetUrl}`,
    };
  },
  eventPublished({ tenantName, eventTitle, eventUrl }) {
    return {
      subject: `Event published: ${eventTitle}`,
      html: baseTemplate(
        'An event was published',
        `<p>The event <strong>${eventTitle}</strong> has been published on ${tenantName}.</p>
         <p style="margin:24px 0;">${button('View event', eventUrl)}</p>`,
      ),
      text: `Event published: ${eventTitle} — ${eventUrl}`,
    };
  },
  aiCompleted({ title, message, url }) {
    return {
      subject: title,
      html: baseTemplate(title, `<p>${message}</p>${url ? `<p style="margin:24px 0;">${button('Open', url)}</p>` : ''}`),
      text: `${title}: ${message}${url ? ` — ${url}` : ''}`,
    };
  },
  test() {
    return {
      subject: 'Test email from City Events Calendar',
      html: baseTemplate('Resend is configured', '<p>This is a test email. Your Resend integration works.</p>'),
      text: 'This is a test email. Your Resend integration works.',
    };
  },
};
