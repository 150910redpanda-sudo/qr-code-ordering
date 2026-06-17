export default async function handler(req, res) {
  const { restaurantId, orderId } = req.query;
  if (!restaurantId || !orderId) {
    return res.status(400).json({ error: 'Missing restaurantId or orderId' });
  }

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(503).json({ error: 'Storage not configured' });

  const key = 'order:' + restaurantId + ':' + orderId;
  const r   = await fetch(kvUrl, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + kvToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(['GET', key])
  });
  const d = await r.json();
  if (!d.result) return res.status(404).json({ error: 'Order not found' });

  const order = JSON.parse(d.result);
  res.setHeader('Cache-Control', 'no-cache, no-store');
  return res.status(200).json({
    status:    order.status,
    updatedAt: order.updatedAt,
    table:     order.table || null
  });
}
