import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Auto-acknowledges Printify publishing for this custom integration.
// When a product's publish begins, Printify locks it ("Publishing") and waits for the
// integration to confirm. This handler answers that immediately so products go "Published".
const API = "https://api.printify.com/v1";
const SHOP_ID = "28370366";
const HANDLE = "https://menlifoot-mvp.vercel.app/shop";

// Constant-time string compare (equal-length hex digests) to avoid timing side-channels.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  const KEY = Deno.env.get("PRINTIFY_API_KEY");
  const SECRET = Deno.env.get("PRINTIFY_WEBHOOK_SECRET");
  if (!KEY || !SECRET) return new Response("not configured", { status: 500 });

  const raw = await req.text();

  // Authenticate: Printify signs the payload with our secret (HMAC-SHA256, X-Pfy-Signature).
  // The secret never travels in the URL. Reject anything that doesn't verify (fail closed).
  const provided = (req.headers.get("x-pfy-signature") ?? "").replace(/^sha256=/i, "").trim().toLowerCase();
  const expected = await hmacHex(SECRET, raw);
  if (!provided || !safeEqual(provided, expected)) {
    return new Response("unauthorized", { status: 401 });
  }

  // deno-lint-ignore no-explicit-any
  let evt: any = {};
  try { evt = JSON.parse(raw); } catch { /* ignore */ }

  const topic = String(evt.type ?? evt.event ?? "");
  const id = evt.resource?.id ?? evt.data?.id ?? evt.resource?.data?.id;

  if (/publish/i.test(topic) && id && /^[a-zA-Z0-9]{1,40}$/.test(String(id))) {
    const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", "User-Agent": "Menlifoot" };
    await fetch(`${API}/shops/${SHOP_ID}/products/${id}/publishing_succeeded.json`, {
      method: "POST", headers,
      body: JSON.stringify({ external: { id: String(id), handle: HANDLE } }),
    }).catch(() => {});
  }

  return new Response("ok", { status: 200 });
});
