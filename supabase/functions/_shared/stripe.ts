import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";

export type StripeEnv = "sandbox" | "live";

// This project talks to Stripe directly with its own secret key (STRIPE_SECRET_KEY) —
// the Lovable connector gateway is not used here. The env argument is accepted for
// backwards compatibility with callers but does not change which key is used.
function getKey(): string {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return key;
}

export function getConnectionApiKey(_env: StripeEnv): string {
  return getKey();
}

export function createStripeClient(_env: StripeEnv): Stripe {
  return new Stripe(getKey(), {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });
}
