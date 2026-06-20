import sgMail from '@sendgrid/mail';
import { readFileSync } from 'fs';
import { join } from 'path';

const NOTIFY_TO = 'info@ethixweb.com';
const FROM_EMAIL = 'akash@ethixweb.com';

const LEAD_FIELDS = [
  'intent', 'intent_detail', 'timeline', 'budget', 'project_notes',
  'name', 'phone', 'email', 'cta_choice',
  'page', 'page_name',
  'utm_source', 'utm_campaign', 'utm_medium', 'utm_term', 'utm_content', 'gclid',
];

function fillTemplate(html, data) {
  return html.replace(/\{\{(\w+)\}\}/g, function (match, key) {
    return data[key] !== undefined && data[key] !== null && data[key] !== '' ? String(data[key]) : '';
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'SendGrid API key not configured' });
  }
  sgMail.setApiKey(apiKey);

  const body = req.body || {};
  const lead = {};
  for (const field of LEAD_FIELDS) lead[field] = body[field] || '';

  if (!lead.email || !lead.name) {
    return res.status(400).json({ error: 'Missing required lead fields (name, email)' });
  }

  try {
    const templatesDir = join(process.cwd(), 'email-templates');
    const notificationHtml = readFileSync(join(templatesDir, 'chatbot-lead-notification.html'), 'utf8');
    const confirmationHtml = readFileSync(join(templatesDir, 'chatbot-lead-confirmation.html'), 'utf8');

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

    await Promise.all([sgMail.send(notificationMsg), sgMail.send(confirmationMsg)]);

    return res.status(200).json({ ok: true });
  } catch (e) {
    const detail = e.response?.body || e.message;
    return res.status(500).json({ error: detail });
  }
}
