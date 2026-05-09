import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { clearCart } = useCart();
  const sentRef = useRef(false);

  useEffect(() => {
    if (!sessionId || sentRef.current) return;
    // Guard against React StrictMode double-invoke and any remounts
    // by persisting a marker for this specific Stripe session.
    const storageKey = `order-confirm-sent:${sessionId}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(storageKey)) {
      sentRef.current = true;
      clearCart();
      return;
    }
    sentRef.current = true;
    if (typeof window !== "undefined") sessionStorage.setItem(storageKey, "1");
    clearCart();
    supabase.functions
      .invoke("send-order-confirmation", {
        body: { sessionId, environment: getStripeEnvironment() },
      })
      .catch((e) => console.error("Order confirmation email failed:", e));
  }, [sessionId, clearCart]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6 glass-card p-8">
        <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
        <h1
          className="text-3xl uppercase tracking-wider text-gradient-gold"
          style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 300 }}
        >
          Pre-order Confirmed
        </h1>
        <p className="text-muted-foreground">
          Thanks for supporting Menlifoot. We'll email you order details and
          shipping updates as your jersey moves through production.
        </p>
        {sessionId && (
          <p className="text-sm text-muted-foreground">
            Order reference:{" "}
            <span className="font-mono text-primary tracking-wider">
              MF-{sessionId.slice(-10).toUpperCase()}
            </span>
          </p>
        )}
        <Link to="/">
          <Button variant="gold" size="lg" className="w-full">
            Back to Menlifoot
          </Button>
        </Link>
      </div>
    </div>
  );
}
