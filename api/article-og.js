// Server-rendered OpenGraph tags for social crawlers sharing an article link.
// Only crawlers reach this (vercel.json rewrites by user-agent); humans get the SPA.
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
  const id = String((req.query && req.query.id) || '').trim();
  const host = req.headers.host || 'menlifoot.ca';
  const articleUrl = `https://${host}/articles/${id}`;

  let title = 'Menlifoot — Le football autrement';
  let desc = 'Le football autrement — analyses, interviews, MVP Podcast et couverture des Grenadiers.';
  let image = `https://${host}/og.png`;

  if (/^[a-zA-Z0-9-]{6,60}$/.test(id)) {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/articles?id=eq.${id}&select=title,summary,content,thumbnail_url&is_published=eq.true&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
      );
      const rows = await r.json();
      const a = Array.isArray(rows) ? rows[0] : null;
      if (a) {
        if (a.title) title = a.title;
        // Use the summary, else the first words of the article body (HTML stripped).
        let intro = a.summary && String(a.summary).trim();
        if (!intro && a.content) intro = String(a.content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (intro) desc = intro.split(/\s+/).slice(0, 25).join(' ') + '…';
        if (a.thumbnail_url) {
          image = /^https?:\/\//.test(a.thumbnail_url) ? a.thumbnail_url : `https://${host}${a.thumbnail_url}`;
        }
      }
    } catch {
      /* fall back to site defaults */
    }
  }

  // Crawlers (esp. WhatsApp) drop preview images over a few hundred KB and prefer JPEG.
  // Article thumbnails are large PNGs, so route them through an image CDN that returns a
  // compact 1200x630 JPEG. The site's own og.png is already small — use it as-is.
  const ogImage = image.includes(`${host}/og.png`)
    ? image
    : `https://images.weserv.nl/?url=${encodeURIComponent(image.replace(/^https?:\/\//, ''))}&w=1200&h=630&fit=cover&output=jpg&q=75`;

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Menlifoot">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(articleUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(ogImage)}">
</head><body>
<h1>${esc(title)}</h1>
<p>${esc(desc)}</p>
<a href="${esc(articleUrl)}">Read on Menlifoot</a>
</body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
  res.status(200).send(html);
}
