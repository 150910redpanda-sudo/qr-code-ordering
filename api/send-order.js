export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return res.status(503).json({
      error: 'SMS not configured — add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER to your Vercel environment variables.'
    });
  }

  const { to, body } = req.body || {};
  if (!to)   return res.status(400).json({ error: 'No recipient phone number — make sure the restaurant entered their number during setup.' });
  if (!body) return res.status(400).json({ error: 'Order is empty.' });

  /* Normalise to E.164: keep digits and leading + */
  const toNum = to.replace(/[^\d+]/g, '');
  if (toNum.length < 7) return res.status(400).json({ error: 'Phone number looks invalid: ' + to });

  const creds = Buffer.from(sid + ':' + token).toString('base64');

  const twRes = await fetch(
    'https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + creds,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ To: toNum, From: from, Body: body }).toString()
    }
  );

  const tw = await twRes.json();
  if (!twRes.ok) {
    return res.status(502).json({ error: tw.message || 'SMS delivery failed.' });
  }

  return res.status(200).json({ ok: true, sid: tw.sid });
}
