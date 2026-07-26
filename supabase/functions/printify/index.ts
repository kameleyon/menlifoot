import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Server-side proxy for the Printify API (Printify has no CORS + needs a secret token).
const API = "https://api.printify.com/v1";
const SHOP_ID = "28370366"; // menlifoot shop (custom_integration)

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
function mapProduct(p: any, full = false) {
  const enabled = (p.variants ?? []).filter((v: any) => v.is_enabled);
  const prices = enabled.map((v: any) => v.price).filter((n: number) => typeof n === "number");
  const img = p.images?.find((i: any) => i.is_default)?.src ?? p.images?.[0]?.src ?? null;
  return {
    id: p.id,
    title: p.title,
    image: img,
    price_cents: prices.length ? Math.min(...prices) : null,
    tags: p.tags ?? [],
    ...(full && {
      description: p.description ?? "",
      images: (p.images ?? []).map((i: any) => i.src),
      variants: enabled.map((v: any) => ({ id: v.id, title: v.title, price: v.price })),
    }),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const KEY = Deno.env.get("PRINTIFY_API_KEY");
  if (!KEY) return json({ error: "PRINTIFY_API_KEY is not configured" }, 500);

  const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", "User-Agent": "Menlifoot" };
  const body = await req.json().catch(() => ({}));
  const action = body.action ?? "products";

  try {
    if (action === "products") {
      const r = await fetch(`${API}/shops/${SHOP_ID}/products.json?limit=50`, { headers });
      const data = await r.json();
      const products = (data.data ?? []).filter((p: any) => p.visible !== false).map((p: any) => mapProduct(p));
      return json({ products });
    }
    if (action === "product") {
      const r = await fetch(`${API}/shops/${SHOP_ID}/products/${body.id}.json`, { headers });
      if (!r.ok) return json({ error: `product ${body.id}: ${r.status}` }, r.status);
      return json({ product: mapProduct(await r.json(), true) });
    }
    if (action === "shipping") {
      const r = await fetch(`${API}/shops/${SHOP_ID}/orders/shipping.json`, { method: "POST", headers, body: JSON.stringify(body.payload) });
      return json(await r.json(), r.status);
    }
    if (action === "order") {
      const r = await fetch(`${API}/shops/${SHOP_ID}/orders.json`, { method: "POST", headers, body: JSON.stringify(body.payload) });
      return json(await r.json(), r.status);
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "proxy error" }, 500);
  }
});
