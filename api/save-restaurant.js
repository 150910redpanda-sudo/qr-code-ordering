export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return res.status(503).json({ error: 'Storage not configured — add KV_REST_API_URL and KV_REST_API_TOKEN in your Vercel project settings.' });
  }

  const { payload, name, id: existingId } = req.body || {};
  if (!payload) return res.status(400).json({ error: 'Missing payload' });

  const id  = existingId || toSlug(name || 'restaurant') + '-' + Math.random().toString(36).slice(2, 8);
  const key = 'r:' + id;

  const kvRes = await fetch(kvUrl, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + kvToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', key, payload])
  });

  if (!kvRes.ok) {
    const err = await kvRes.text();
    return res.status(502).json({ error: 'Storage write failed: ' + err });
  }

  return res.status(200).json({ id });
}

function toSlug(s) {
  return String(s).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'restaurant';
}
