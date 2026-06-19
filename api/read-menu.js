export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Service not configured — ANTHROPIC_API_KEY missing.' });

  const { image, imageType, prompt } = req.body || {};
  if (!image || !imageType) return res.status(400).json({ error: 'Missing image or imageType.' });

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        /* large multi-section menus (50+ items, each with name/price/desc/tags/options)
           need far more than a couple thousand tokens of JSON output — too low a cap
           truncates the response mid-item and breaks JSON.parse on the client */
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: imageType, data: image } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data?.error?.message || 'AI service error.' });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reach AI service. Please try again.' });
  }
}
