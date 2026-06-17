export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { restaurantId, orderId, status } = req.body || {};
  if (!restaurantId || !orderId || !status) {
    return res.status(400).json({ error: 'Missing restaurantId, orderId or status' });
  }

  const VALID = ['new', 'preparing', 'ready', 'done'];
  if (!VALID.includes(status)) {
    return res.status(400).json({ error: 'Invalid status: ' + status });
  }

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(503).json({ error: 'Storage not configured' });

  const key    = 'order:' + restaurantId + ':' + orderId;
  const getRes = await fetch(kvUrl, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + kvToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(['GET', key])
  });
  const getData = await getRes.json();
  if (!getData.result) return res.status(404).json({ error: 'Order not found' });

  const order = JSON.parse(getData.result);
  order.status    = status;
  order.updatedAt = Date.now();

  await fetch(kvUrl, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + kvToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', key, JSON.stringify(order), 'EX', 604800])
  });

  return res.status(200).json({ ok: true, order });
}
