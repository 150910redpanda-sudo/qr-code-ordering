export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI reading not configured — add ANTHROPIC_API_KEY in your Vercel project settings.' });
  }

  const { imageB64, imageType } = req.body || {};
  if (!imageB64) return res.status(400).json({ error: 'Missing imageB64' });

  const mediaType = (imageType === 'image/png') ? 'image/png' : 'image/jpeg';

  const schema = {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            price: { anyOf: [{ type: 'number' }, { type: 'null' }] },
            desc: { type: 'string' },
            section: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: { name: { type: 'string' }, price: { anyOf: [{ type: 'number' }, { type: 'null' }] } },
                required: ['name', 'price'],
                additionalProperties: false
              }
            }
          },
          required: ['name', 'price', 'desc', 'section', 'tags', 'options'],
          additionalProperties: false
        }
      },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            note: { type: 'string' },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: { name: { type: 'string' }, price: { anyOf: [{ type: 'number' }, { type: 'null' }] } },
                required: ['name', 'price'],
                additionalProperties: false
              }
            }
          },
          required: ['name', 'note', 'options'],
          additionalProperties: false
        }
      },
      menuNote: { type: 'string' }
    },
    required: ['items', 'sections', 'menuNote'],
    additionalProperties: false
  };

  const prompt = `Read every dish on this restaurant menu photo and extract it precisely.

Rules:
- "items": one entry per dish/drink. "section" is the heading it's grouped under exactly as printed (e.g. "Antipasti", "Pizze"). If a dish has no price printed anywhere (e.g. "ask your server"), set price to null — never invent a price.
- "desc": the dish's description text (ingredients etc.), exactly as printed. Empty string if none.
- "tags": short dietary/style badges printed next to the dish (e.g. "V", "VG", "GF", "DF", "Spicy") — only if actually marked on the menu, not inferred.
- "options": per-dish add-ons/swaps printed directly under that one dish (e.g. "+ extra topping £1.50").
- "sections": one entry per section heading that has a section-wide note or section-wide shared add-on (e.g. "Gluten free base available +£2" printed once under a pizza section, applying to every pizza in it) — "note" for free text, "options" for priced add-ons. Skip sections with neither.
- "menuNote": any page-wide legend or disclaimer not tied to one section (e.g. "V = Vegetarian, GF = Gluten free" key, or an allergy notice). Empty string if none.
- Preserve the menu's own section names and dish names verbatim — don't translate, rename, or merge sections.
- Read the full image even if multi-column — don't skip a column or section.`;

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        output_config: { format: { type: 'json_schema', schema } },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageB64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      return res.status(502).json({ error: (data && data.error && data.error.message) || 'AI request failed' });
    }
    if (data.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'AI declined to read this image' });
    }

    const textBlock = (data.content || []).find(function (b) { return b.type === 'text'; });
    if (!textBlock) return res.status(502).json({ error: 'No output returned' });

    let parsed;
    try { parsed = JSON.parse(textBlock.text); }
    catch (e) { return res.status(502).json({ error: 'AI returned malformed output' }); }

    return res.status(200).json({
      items: Array.isArray(parsed.items) ? parsed.items : [],
      sections: Array.isArray(parsed.sections) ? parsed.sections : [],
      menuNote: parsed.menuNote || ''
    });
  } catch (e) {
    return res.status(502).json({ error: 'AI request failed: ' + (e && e.message ? e.message : 'unknown error') });
  }
}
