import sgMail from '@sendgrid/mail';

// Temporary diagnostic endpoint — isolates SendGrid send/auth/sender-verification
// issues from the rest of the lead flow (no templates, no payload parsing).
// Hit it directly: GET or POST /api/test-email
// Remove this file once the root cause is confirmed fixed.

const NOTIFY_TO = ['info@ethixweb.com', 'akash@ethixweb.com'];
const FROM_EMAIL = 'akash@ethixweb.com';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  console.log('[test-email] SENDGRID_API_KEY present:', Boolean(apiKey), apiKey ? '(len=' + apiKey.length + ')' : '');
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'SENDGRID_API_KEY not set in environment' });
  }
  sgMail.setApiKey(apiKey);

  const msg = {
    to: NOTIFY_TO,
    from: FROM_EMAIL,
    subject: 'Demski Chatbot — SendGrid test email',
    html: '<p>This is a diagnostic test from <code>/api/test-email</code>. If you received this, SendGrid sending works for FROM_EMAIL=' + FROM_EMAIL + '.</p>',
  };

  console.log('[test-email] Attempting send. from=%s to=%s', FROM_EMAIL, JSON.stringify(NOTIFY_TO));

  try {
    const [response] = await sgMail.send(msg);
    console.log('[test-email] SendGrid raw response status:', response.statusCode);
    console.log('[test-email] SendGrid raw response headers:', JSON.stringify(response.headers));
    return res.status(200).json({
      ok: true,
      sentTo: NOTIFY_TO,
      from: FROM_EMAIL,
      sendgridStatusCode: response.statusCode,
      sendgridHeaders: response.headers,
    });
  } catch (e) {
    const status = e.code || e.response?.statusCode;
    const body = e.response?.body;
    const headers = e.response?.headers;
    console.error('[test-email] SendGrid send FAILED');
    console.error('[test-email] status:', status);
    console.error('[test-email] body:', JSON.stringify(body));
    console.error('[test-email] headers:', JSON.stringify(headers));
    console.error('[test-email] message:', e.message);
    return res.status(502).json({
      ok: false,
      status,
      body,
      headers,
      message: e.message,
    });
  }
}
