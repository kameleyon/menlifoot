import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LineItemInput {
  priceId: string;
  quantity: number;
  variants?: string; // free-text breakdown for fulfillment metadata
}

interface RequestBody {
  items: LineItemInput[];
  customerEmail?: string;
  returnUrl: string;
  environment: StripeEnv;
}

// Shipping rates in CAD cents — Canada-origin store
const SHIPPING_OPTIONS = [
  {
    label: "Canada (3-7 business days)",
    amount: 1200,
    countries: ["CA"],
  },
  {
    label: "USA (5-10 business days)",
    amount: 2000,
    countries: ["US"],
  },
  {
    label: "UK & EU (7-14 business days)",
    amount: 3500,
    countries: [
      "GB", "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
      "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL",
      "PT", "RO", "SK", "SI", "ES", "SE", "NO", "CH", "IS",
    ],
  },
  {
    label: "Rest of world (10-21 business days)",
    amount: 4500,
    countries: [
      "AU", "NZ", "JP", "KR", "SG", "HK", "TW", "MY", "TH", "ID", "PH",
      "VN", "IN", "AE", "SA", "IL", "TR", "ZA", "BR", "MX", "AR", "CL",
      "CO", "PE", "UY", "EG", "NG", "KE", "MA",
    ],
  },
];

const SHIP_TO_COUNTRIES = SHIPPING_OPTIONS.flatMap((o) => o.countries);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as RequestBody;

    if (!body.items?.length) {
      return new Response(JSON.stringify({ error: "Cart is empty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.returnUrl || !body.environment) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = createStripeClient(body.environment);

    // Resolve human-readable price IDs via lookup_keys
    const uniquePriceIds = [...new Set(body.items.map((i) => i.priceId))];
    for (const id of uniquePriceIds) {
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        throw new Error(`Invalid priceId: ${id}`);
      }
    }
    const prices = await stripe.prices.list({ lookup_keys: uniquePriceIds });
    if (prices.data.length === 0) {
      throw new Error("Prices not found");
    }
    const priceMap = new Map(
      prices.data.map((p) => [p.lookup_key as string, p.id]),
    );

    // Aggregate cart lines per priceId (variants captured in metadata)
    const aggregated = new Map<string, { quantity: number; variants: string[] }>();
    for (const item of body.items) {
      const stripePriceId = priceMap.get(item.priceId);
      if (!stripePriceId) {
        throw new Error(`Price not found: ${item.priceId}`);
      }
      const existing = aggregated.get(stripePriceId) ?? { quantity: 0, variants: [] };
      existing.quantity += item.quantity;
      if (item.variants) {
        existing.variants.push(`${item.variants} x${item.quantity}`);
      }
      aggregated.set(stripePriceId, existing);
    }

    const line_items = [...aggregated.entries()].map(([price, info]) => ({
      price,
      quantity: info.quantity,
    }));

    // Build variant metadata (≤500 chars per Stripe key)
    const variantSummary: Record<string, string> = {};
    let i = 0;
    for (const [priceId, info] of aggregated.entries()) {
      if (info.variants.length) {
        variantSummary[`variant_${i}`] = `${priceId}: ${info.variants.join(" | ")}`.slice(0, 500);
        i++;
      }
    }

    const session = await stripe.checkout.sessions.create({
      line_items,
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: body.returnUrl,
      ...(body.customerEmail && { customer_email: body.customerEmail }),
      shipping_address_collection: {
        allowed_countries: SHIP_TO_COUNTRIES as any,
      },
      shipping_options: SHIPPING_OPTIONS.map((opt) => ({
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: opt.amount, currency: "cad" },
          display_name: opt.label,
          delivery_estimate: {
            minimum: { unit: "business_day", value: 3 },
            maximum: { unit: "business_day", value: 21 },
          },
        },
      })),
      phone_number_collection: { enabled: true },
      metadata: {
        order_type: "preorder",
        ...variantSummary,
      },
    });

    return new Response(
      JSON.stringify({ clientSecret: session.client_secret }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("create-checkout error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
