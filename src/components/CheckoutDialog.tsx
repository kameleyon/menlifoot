import { useEffect, useState } from "react";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { Loader2 } from "lucide-react";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckoutDialog({ open, onOpenChange }: CheckoutDialogProps) {
  const { items } = useCart();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setError(null);
      return;
    }
    if (items.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        // Map cart items to checkout line items using Stripe price IDs
        const lineItems = items.map((it) => {
          // productId is jersey-black or jersey-white → price id
          const priceId =
            it.productId === "jersey-black"
              ? "jersey_black_preorder"
              : "jersey_white_preorder";
          return {
            priceId,
            quantity: it.quantity,
            variants: `${it.name} (${it.variant})`,
          };
        });

        const { data, error: fnError } = await supabase.functions.invoke(
          "create-checkout",
          {
            body: {
              items: lineItems,
              returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
              environment: getStripeEnvironment(),
            },
          },
        );
        if (cancelled) return;
        if (fnError || !data?.clientSecret) {
          throw new Error(fnError?.message || "Failed to start checkout");
        }
        setClientSecret(data.clientSecret);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Checkout failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto p-0">
        <DialogTitle className="sr-only">Checkout</DialogTitle>
        {error ? (
          <div className="p-8 text-center text-destructive">{error}</div>
        ) : !clientSecret ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div id="checkout" className="bg-white">
            <EmbeddedCheckoutProvider
              stripe={getStripe()}
              options={{ fetchClientSecret: async () => clientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
