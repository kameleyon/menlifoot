import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Auto-acknowledges Printify publishing for this custom integration.
// When a product's publish begins, Printify locks it ("Publishing") and waits for the
// integration to confirm. This handler answers that immediately so products go "Published".
const API = "https://api.printify.com/v1";
const SHOP_ID = "28370366";
const HANDLE = "https://menlifoot-mvp.vercel.app/shop";

serve(async (req) => {
  const KEY = Deno.env.get("PRINTIFY_API_KEY");
  if (!KEY) return new Response("not configured", { status: 500 });

  const raw = await req.text();
  // deno-lint-ignore no-explicit-any
  let evt: any = {};
  try { evt = JSON.parse(raw); } catch { /* ignore */ }

  const topic = String(evt.type ?? evt.event ?? "");
  const id = evt.resource?.id ?? evt.data?.id ?? evt.resource?.data?.id;

  if (/publish/i.test(topic) && id && /^[a-zA-Z0-9]{1,40}$/.test(String(id))) {
    const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", "User-Agent": "Menlifoot" };
    // Tell Printify the store finished publishing this product.
    await fetch(`${API}/shops/${SHOP_ID}/products/${id}/publishing_succeeded.json`, {
      method: "POST", headers,
      body: JSON.stringify({ external: { id: String(id), handle: HANDLE } }),
    }).catch(() => {});
  }

  return new Response("ok", { status: 200 });
});
