export default async function handler(req, res) {
  const { restaurantId } = req.query;
  if (!restaurantId) return res.status(400).json({ error: 'Missing restaurantId' });

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(503).json({ error: 'Storage not configured' });

  /* LRANGE orders list */
  const listRes  = await fetch(kvUrl, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + kvToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(['LRANGE', 'orders:' + restaurantId, 0, 99])
  });
  const listData = await listRes.json();
  const orderIds = listData.result || [];

  if (!orderIds.length) {
    res.setHeader('Cache-Control', 'no-cache, no-store');
    return res.status(200).json({ orders: [] });
  }

  /* Pipeline GET each order */
  const pipeline = orderIds.map(id => ['GET', 'order:' + restaurantId + ':' + id]);
  const pipeRes  = await fetch(kvUrl + '/pipeline', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + kvToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(pipeline)
  });
  const pipeData = await pipeRes.json();

  const orders = (Array.isArray(pipeData) ? pipeData : [])
    .map(r => { try { return JSON.parse(r.result); } catch (e) { return null; } })
    .filter(Boolean);

  res.setHeader('Cache-Control', 'no-cache, no-store');
  return res.status(200).json({ orders });
}
