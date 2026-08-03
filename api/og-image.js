// First-party OG image endpoint: returns a compact 1200x630 JPEG from OUR domain,
// edge-cached, so Twitter/WhatsApp fetch it directly (no third-party host, no slow
// on-demand resize on the crawler's request). Source must be an allowlisted image host.
const ALLOW = ["tjotexujwnfltszqqovk.supabase.co", "images-api.printify.com"];

export default async function handler(req, res) {
  const raw = String((req.query && req.query.url) || "");
  let host = "";
  try { host = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).host; } catch { /* invalid */ }
  if (!ALLOW.includes(host)) { res.status(400).send("bad source"); return; }

  const clean = raw.replace(/^https?:\/\//, "");
  const src = `https://images.weserv.nl/?url=${encodeURIComponent(clean)}&w=1200&h=630&fit=cover&output=jpg&q=80`;
  try {
    const r = await fetch(src);
    if (!r.ok) { res.status(502).send("upstream error"); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "image/jpeg");
    // Cache hard at the edge so the crawler's fetch is instant after the first hit.
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800");
    res.status(200).send(buf);
  } catch {
    res.status(502).send("fetch failed");
  }
}
