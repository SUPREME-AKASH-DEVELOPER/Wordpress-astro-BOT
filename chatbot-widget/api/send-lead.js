import sgMail from '@sendgrid/mail';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const NOTIFY_TO = ['andrew.demski@demskigroupdev.com', 'aaron.demski@demskigroupdev.com'];
const FROM_EMAIL = 'aaron.demski@demskigroupdev.com';

const LEAD_FIELDS = [
  'intent', 'intent_detail', 'budget', 'project_notes',
  'name', 'phone', 'email', 'cta_choice',
  'page', 'page_name',
  'utm_source', 'utm_campaign', 'utm_medium', 'utm_term', 'utm_content', 'gclid',
];

function fillTemplate(html, data) {
  return html.replace(/\{\{(\w+)\}\}/g, function (_match, key) {
    return data[key] !== undefined && data[key] !== null && data[key] !== '' ? String(data[key]) : '';
  });
}

function log(...args) {
  console.log('[send-lead]', ...args);
}

function logError(...args) {
  console.error('[send-lead]', ...args);
}

// Extracts the useful bits out of a SendGrid error so they show up in
// Vercel Function Logs instead of an opaque "ECONNRESET"-style message.
function describeSendGridError(e) {
  const status = e.code || e.response?.statusCode;
  const body = e.response?.body;
  return {
    status,
    message: e.message,
    errors: body?.errors || body,
  };
}

export default async function handler(req, res) {
  // CORS preflight: the widget may be served from a different origin than
  // this API (e.g. embedded via the standalone widget domain), which makes
  // the browser send an OPTIONS preflight before the real POST. Without
  // this, the preflight gets a 405 and the browser blocks the POST,
  // producing a silent failure with no email ever attempted.
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    logError('Rejected non-POST request:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    logError('SENDGRID_API_KEY is not set in the environment');
    return res.status(500).json({ error: 'SendGrid API key not configured' });
  }
  sgMail.setApiKey(apiKey);

  const body = req.body || {};
  const lead = {};
  for (const field of LEAD_FIELDS) lead[field] = body[field] || '';

  log('Incoming lead payload:', lead);

  if (!lead.email || !lead.name) {
    logError('Missing required fields. name=%s email=%s', lead.name, lead.email);
    return res.status(400).json({ error: 'Missing required lead fields (name, email)' });
  }

  function readTemplate(filename) {
    const candidates = [
      join(__dirname, '..', 'email-templates', filename),
      join(__dirname, 'email-templates', filename),
      join(process.cwd(), 'email-templates', filename),
    ];
    for (const candidate of candidates) {
      try {
        const content = readFileSync(candidate, 'utf8');
        log('Loaded template', filename, 'from', candidate);
        return content;
      } catch (e) {
        // try next candidate
      }
    }
    throw new Error('Could not find ' + filename + ' in any of: ' + candidates.join(', '));
  }

  let notificationHtml, confirmationHtml;
  try {
    notificationHtml = readTemplate('chatbot-lead-notification.html');
    confirmationHtml = readTemplate('chatbot-lead-confirmation.html');
  } catch (e) {
    logError('Failed to read email templates:', e.message, '__dirname=', __dirname, 'cwd=', process.cwd());
    return res.status(500).json({ error: 'Email templates not found on server', detail: e.message, dirname: __dirname, cwd: process.cwd() });
  }

  const notificationMsg = {
    to: NOTIFY_TO,
    from: FROM_EMAIL,
    subject: 'New Chatbot Lead: ' + lead.name,
    html: fillTemplate(notificationHtml, lead),
  };

  const confirmationMsg = {
    to: lead.email,
    from: FROM_EMAIL,
    subject: 'Thanks for reaching out to The Demski Group',
    html: fillTemplate(confirmationHtml, {
      user_name: lead.name,
      user_email: lead.email,
      cta_choice: lead.cta_choice,
    }),
  };

  log('Sending lead notification to', NOTIFY_TO, 'from', FROM_EMAIL);
  log('Sending confirmation to', lead.email, 'from', FROM_EMAIL);

  // Send independently (not Promise.all) so one failing recipient doesn't
  // mask whether the other actually succeeded — both results are reported.
  const [notificationResult, confirmationResult] = await Promise.allSettled([
    sgMail.send(notificationMsg),
    sgMail.send(confirmationMsg),
  ]);

  const notificationOk = notificationResult.status === 'fulfilled';
  const confirmationOk = confirmationResult.status === 'fulfilled';

  if (notificationOk) {
    log('Lead notification email: SENT to', NOTIFY_TO);
  } else {
    logError('Lead notification email: FAILED —', JSON.stringify(describeSendGridError(notificationResult.reason)));
  }

  if (confirmationOk) {
    log('User confirmation email: SENT to', lead.email);
  } else {
    logError('User confirmation email: FAILED —', JSON.stringify(describeSendGridError(confirmationResult.reason)));
  }

  if (!notificationOk && !confirmationOk) {
    const detail = describeSendGridError(notificationResult.reason);
    log('Final API response: 502, both emails failed');
    return res.status(502).json({
      ok: false,
      error: 'Both notification and confirmation emails failed to send',
      detail,
    });
  }

  if (!notificationOk || !confirmationOk) {
    log('Final API response: 207, partial success');
    return res.status(207).json({
      ok: false,
      notificationSent: notificationOk,
      confirmationSent: confirmationOk,
      error: !notificationOk
        ? describeSendGridError(notificationResult.reason)
        : describeSendGridError(confirmationResult.reason),
    });
  }

  log('Final API response: 200, both emails sent');
  return res.status(200).json({ ok: true, notificationSent: true, confirmationSent: true });
}
