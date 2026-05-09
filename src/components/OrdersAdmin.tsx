import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Package, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStripeEnvironment } from "@/lib/stripe";

interface Order {
  id: string;
  reference: string;
  createdAt: number | null;
  email: string | null;
  name: string | null;
  phone: string | null;
  address: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  } | null;
  items: { name: string; quantity: number }[];
  variants: string[];
  subtotal: string;
  shipping: string;
  tax: string;
  total: string;
  currency: string;
  status: string;
}

function formatAddress(addr: Order["address"]) {
  if (!addr) return "—";
  return [
    addr.line1,
    addr.line2,
    [addr.postal_code, addr.city, addr.state].filter(Boolean).join(" "),
    addr.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export function OrdersAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-orders", {
        body: { environment: getStripeEnvironment() },
      });
      if (error) throw error;
      setOrders(data?.orders || []);
    } catch (e) {
      toast({
        title: "Failed to load orders",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const copy = (order: Order) => {
    const text = [
      order.reference,
      order.name,
      order.email,
      order.phone,
      formatAddress(order.address),
      order.items
        .map((i) => `${i.quantity}× ${i.name}`)
        .join(" | "),
      order.variants.join(" • "),
      order.total,
    ]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopiedId(order.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-xl uppercase tracking-wider text-gradient-gold"
          style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 300 }}
        >
          Orders ({orders.length})
        </h2>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
          No paid orders yet.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="glass-card p-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-start"
            >
              <div>
                <div className="font-mono text-primary text-sm tracking-wider">
                  {o.reference}
                </div>
                <div className="text-foreground font-medium mt-1">
                  {o.name || "—"}
                </div>
                <div className="text-sm text-muted-foreground">{o.email}</div>
                {o.phone && (
                  <div className="text-sm text-muted-foreground">
                    {o.phone}
                  </div>
                )}
                {o.createdAt && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(o.createdAt).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="text-sm">
                <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                  Shipping
                </div>
                <div className="text-foreground">
                  {formatAddress(o.address)}
                </div>
                <div className="mt-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
                  Items
                </div>
                <ul className="text-foreground">
                  {o.items.map((i, idx) => (
                    <li key={idx}>
                      {i.quantity}× {i.name}
                    </li>
                  ))}
                </ul>
                {o.variants.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {o.variants.join(" • ")}
                  </div>
                )}
              </div>
              <div className="md:text-right">
                <div className="text-primary font-semibold text-lg">
                  {o.total}
                </div>
                <div className="text-xs text-muted-foreground">
                  Sub {o.subtotal} · Ship {o.shipping || "—"} · Tax{" "}
                  {o.tax || "—"}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => copy(o)}
                >
                  {copiedId === o.id ? (
                    <Check className="h-3 w-3 mr-1" />
                  ) : (
                    <Copy className="h-3 w-3 mr-1" />
                  )}
                  Copy
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
