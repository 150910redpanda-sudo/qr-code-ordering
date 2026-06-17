export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return res.status(503).json({ error: 'Storage not configured' });
  }

  const key   = 'r:' + id;
  const kvRes = await fetch(kvUrl, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + kvToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(['GET', key])
  });

  const data = await kvRes.json();
  if (!data.result) return res.status(404).json({ error: 'Restaurant not found' });

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  return res.status(200).json({ payload: data.result });
}
