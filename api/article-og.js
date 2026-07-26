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
  const host = req.headers.host || 'menlifoot-mvp.vercel.app';
  const articleUrl = `https://${host}/articles/${id}`;

  let title = 'Menlifoot — Le football autrement';
  let desc = 'Le football autrement — analyses, interviews, MVP Podcast et couverture des Grenadiers.';
  let image = `https://${host}/og.png`;

  if (/^[a-zA-Z0-9-]{6,60}$/.test(id)) {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/articles?id=eq.${id}&select=title,summary,thumbnail_url&is_published=eq.true&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
      );
      const rows = await r.json();
      const a = Array.isArray(rows) ? rows[0] : null;
      if (a) {
        if (a.title) title = a.title;
        if (a.summary) desc = String(a.summary).split(/\s+/).slice(0, 25).join(' ');
        if (a.thumbnail_url) {
          image = /^https?:\/\//.test(a.thumbnail_url) ? a.thumbnail_url : `https://${host}${a.thumbnail_url}`;
        }
      }
    } catch {
      /* fall back to site defaults */
    }
  }

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Menlifoot">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(articleUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
</head><body>
<h1>${esc(title)}</h1>
<p>${esc(desc)}</p>
<a href="${esc(articleUrl)}">Read on Menlifoot</a>
</body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
  res.status(200).send(html);
}
