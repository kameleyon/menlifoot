// Per-product OpenGraph tags for social crawlers sharing a product link (/shop?product=ID).
// Only crawlers reach this (vercel.json rewrites by user-agent). Shows the product image + title, no price.
const SUPABASE_URL = 'https://pgxeinqbqyyqvzoevogd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uiT1RlmSzFFKxq9asuTIwQ_sD9WxXj-';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export default async function handler(req, res) {
  const id = String((req.query && (req.query.product || req.query.id)) || '').trim();
  const host = req.headers.host || 'menlifoot-mvp.vercel.app';
  const shareUrl = `https://${host}/shop?product=${id}`;

  let title = 'Menlifoot Store';
  let image = `https://${host}/og.png`;

  if (/^[a-zA-Z0-9]{1,40}$/.test(id)) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/printify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ action: 'product', id }),
      });
      const data = await r.json();
      const p = data && data.product;
      if (p) {
        if (p.title) title = p.title;
        const img = p.image || (p.images && p.images[0] && p.images[0].src);
        if (img) image = img;
      }
    } catch {
      /* fall back to store defaults */
    }
  }

  // Product mockups are large; route through an image CDN for a compact JPEG (crawler-friendly). No crop.
  const ogImage = image.includes(`${host}/og.png`)
    ? image
    : `https://images.weserv.nl/?url=${encodeURIComponent(image.replace(/^https?:\/\//, ''))}&w=1200&h=630&fit=contain&bg=101012&output=jpg&q=80`;

  const desc = 'Menlifoot Store — shop the collection.';

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Menlifoot">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(shareUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(ogImage)}">
</head><body>
<h1>${esc(title)}</h1>
<a href="${esc(shareUrl)}">Shop on Menlifoot</a>
</body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
  res.status(200).send(html);
}
