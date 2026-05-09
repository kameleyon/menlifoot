import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { clearCart } = useCart();

  useEffect(() => {
    if (sessionId) clearCart();
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
          <p className="text-xs text-muted-foreground/70 break-all">
            Order reference: {sessionId}
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
