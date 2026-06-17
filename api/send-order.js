export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { to, body, restaurantId, orderData } = req.body || {};
  if (!body) return res.status(400).json({ error: 'Order is empty.' });

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  const sid     = process.env.TWILIO_ACCOUNT_SID;
  const token   = process.env.TWILIO_AUTH_TOKEN;
  const from    = process.env.TWILIO_FROM_NUMBER;

  /* 1 — Save order to KV (best-effort, independent of SMS) */
  let orderId = null;
  if (restaurantId && orderData && kvUrl && kvToken) {
    try {
      orderId = 'ord-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      const order = {
        id: orderId,
        restaurantId,
        ...orderData,
        status: 'new',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await fetch(kvUrl + '/pipeline', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + kvToken, 'Content-Type': 'application/json' },
        body: JSON.stringify([
          ['SET', 'order:' + restaurantId + ':' + orderId, JSON.stringify(order), 'EX', 604800],
          ['LPUSH', 'orders:' + restaurantId, orderId],
          ['LTRIM', 'orders:' + restaurantId, 0, 199]
        ])
      });
    } catch (e) {
      orderId = null;
    }
  }

  /* 2 — Send SMS via Twilio (only if phone and credentials present) */
  if (to && sid && token && from) {
    const toNum = to.replace(/[^\d+]/g, '');
    if (toNum.length < 7) {
      return res.status(400).json({ error: 'Phone number looks invalid: ' + to, orderId });
    }
    const creds  = Buffer.from(sid + ':' + token).toString('base64');
    const twRes  = await fetch(
      'https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + creds,
          'Content-Type':  'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ To: toNum, From: from, Body: body }).toString()
      }
    );
    const tw = await twRes.json();
    if (!twRes.ok) {
      return res.status(502).json({ error: tw.message || 'SMS delivery failed.', orderId });
    }
    return res.status(200).json({ ok: true, smsSid: tw.sid, orderId });
  }

  /* 3 — No SMS path: succeed if order was saved to dashboard */
  if (orderId) {
    return res.status(200).json({ ok: true, orderId, smsSkipped: true });
  }

  return res.status(503).json({
    error: !sid
      ? 'SMS not configured — add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER to Vercel environment variables.'
      : 'Order could not be saved or sent.'
  });
}
