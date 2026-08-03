import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Package, Copy, Check, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStripeEnvironment } from "@/lib/stripe";

interface Order {
  id: string;
  reference: string;
  createdAt: number | null;
  livemode: boolean;
  isTest: boolean;
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
  items: { name: string; quantity: number; personalization?: string | null }[];
  variants: string[];
  carrierName?: string | null;
  language?: string | null;
  amountSubtotal: number;
  amountShipping: number;
  amountTax: number;
  amountTotal: number;
  subtotal: string;
  shipping: string;
  tax: string;
  total: string;
  currency: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  trackingNumber: string | null;
  carrier: string | null;
  notes: string | null;
}

const STATUSES = [
  { value: "new", label: "New" },
  { value: "in_process", label: "In process" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "canceled", label: "Canceled" },
];

const CARRIERS = [
  { value: "canada_post", label: "Canada Post" },
  { value: "ups", label: "UPS" },
  { value: "fedex", label: "FedEx" },
  { value: "usps", label: "USPS" },
  { value: "amazon", label: "Amazon" },
  { value: "other", label: "Other" },
];

const LANG_LABEL: Record<string, string> = { en: "EN", fr: "FR", es: "ES", ht: "HT" };

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

function fmtMoney(amountCents: number, currency: string) {
  const cur = currency.toUpperCase();
  const prefix = cur === "CAD" ? "CA$" : cur === "USD" ? "US$" : `${cur} `;
  return `${prefix}${(amountCents / 100).toFixed(2)}`;
}

function statusColor(s: string) {
  switch (s) {
    case "new": return "bg-muted text-foreground";
    case "in_process": return "bg-blue-500/20 text-blue-300 border-blue-500/40";
    case "shipped": return "bg-primary/20 text-primary border-primary/40";
    case "delivered": return "bg-green-500/20 text-green-300 border-green-500/40";
    case "canceled": return "bg-red-500/20 text-red-300 border-red-500/40";
    default: return "bg-muted";
  }
}

function extractSize(variants: string[]): string | null {
  for (const v of variants) {
    const m = v.match(/\b(XS|S|M|L|XL|XXL)\b/i);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

export function OrdersAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showTest, setShowTest] = useState(false);
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [filterState, setFilterState] = useState<string>("all");
  const [filterSize, setFilterSize] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortDir, setSortDir] = useState<"newest" | "oldest">("newest");
  // Per-row edit drafts
  const [drafts, setDrafts] = useState<Record<string, {
    status: string;
    carrier: string;
    carrierName: string;
    trackingNumber: string;
  }>>({});
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-orders", {
        body: { environment: getStripeEnvironment() },
      });
      if (error) throw error;
      const list: Order[] = data?.orders || [];
      setOrders(list);
      const ds: typeof drafts = {};
      for (const o of list) {
        ds[o.id] = {
          status: o.fulfillmentStatus,
          carrier: o.carrier || "",
          carrierName: o.carrierName || "",
          trackingNumber: o.trackingNumber || "",
        };
      }
      setDrafts(ds);
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

  const visible = useMemo(() => {
    const list = orders.filter((o) => {
      if (!showTest && o.isTest) return false;
      if (filterCountry !== "all" && o.address?.country !== filterCountry) return false;
      if (filterState !== "all" && o.address?.state !== filterState) return false;
      if (filterStatus !== "all" && o.fulfillmentStatus !== filterStatus) return false;
      if (filterSize !== "all" && extractSize(o.variants) !== filterSize) return false;
      return true;
    });
    list.sort((a, b) => sortDir === "newest" ? (b.createdAt ?? 0) - (a.createdAt ?? 0) : (a.createdAt ?? 0) - (b.createdAt ?? 0));
    return list;
  }, [orders, showTest, filterCountry, filterState, filterStatus, filterSize, sortDir]);

  const totals = useMemo(() => {
    let revenue = 0;
    let shipping = 0;
    let currency = "CAD";
    for (const o of visible) {
      revenue += o.amountSubtotal + o.amountShipping;
      shipping += o.amountShipping;
      currency = o.currency || currency;
    }
    return { revenue, shipping, currency, count: visible.length };
  }, [visible]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) if (o.address?.country) set.add(o.address.country);
    return [...set].sort();
  }, [orders]);

  const states = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) if (o.address?.state) set.add(o.address.state);
    return [...set].sort();
  }, [orders]);

  const sizes = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) {
      const s = extractSize(o.variants);
      if (s) set.add(s);
    }
    return [...set].sort();
  }, [orders]);

  const copy = (order: Order) => {
    const text = [
      order.reference,
      order.name,
      order.email,
      order.phone,
      formatAddress(order.address),
      order.items.map((i) => `${i.quantity}× ${i.name}`).join(" | "),
      order.variants.join(" • "),
      order.total,
    ]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopiedId(order.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const saveStatus = async (order: Order, sendEmail: boolean) => {
    const draft = drafts[order.id];
    if (!draft) return;
    if (draft.status === "shipped" && !draft.trackingNumber) {
      toast({
        title: "Tracking required",
        description: "Add a tracking number before marking as shipped.",
        variant: "destructive",
      });
      return;
    }
    setSavingId(order.id);
    try {
      const { error } = await supabase.functions.invoke("update-order-status", {
        body: {
          sessionId: order.id,
          environment: getStripeEnvironment(),
          status: draft.status,
          trackingNumber: draft.trackingNumber || null,
          carrier: draft.carrier || null,
          carrierName: draft.carrier === "other" ? (draft.carrierName || null) : null,
          sendEmail,
        },
      });
      if (error) throw error;
      toast({
        title: "Order updated",
        description: sendEmail
          ? "Status saved and customer notified."
          : "Status saved.",
      });
      await load();
    } catch (e) {
      toast({
        title: "Failed to update",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  const updateDraft = (id: string, patch: Partial<{ status: string; carrier: string; carrierName: string; trackingNumber: string }>) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2
            className="text-xl uppercase tracking-wider text-gradient-gold"
            style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 300 }}
          >
            Orders ({totals.count})
          </h2>
          <div className="text-sm text-muted-foreground mt-1">
            Revenue (subtotal + shipping):{" "}
            <span className="text-primary font-semibold">
              {fmtMoney(totals.revenue, totals.currency)}
            </span>
            <span className="mx-2">·</span>
            Shipping: {fmtMoney(totals.shipping, totals.currency)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="show-test" checked={showTest} onCheckedChange={setShowTest} />
            <Label htmlFor="show-test" className="text-xs uppercase tracking-wider cursor-pointer">
              Show test
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-2 grid-cols-2 md:grid-cols-4 mb-6">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortDir} onValueChange={(v) => setSortDir(v as "newest" | "oldest")}>
          <SelectTrigger><SelectValue placeholder="Date" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCountry} onValueChange={setFilterCountry}>
          <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterState} onValueChange={setFilterState}>
          <SelectTrigger><SelectValue placeholder="State/Province" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {states.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSize} onValueChange={setFilterSize}>
          <SelectTrigger><SelectValue placeholder="Size" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sizes</SelectItem>
            {sizes.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
          No orders match the current filters.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((o) => {
            const draft = drafts[o.id] || {
              status: o.fulfillmentStatus,
              carrier: o.carrier || "",
              carrierName: o.carrierName || "",
              trackingNumber: o.trackingNumber || "",
            };
            return (
              <div key={o.id} className="glass-card p-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-start">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-primary text-sm tracking-wider">
                        {o.reference}
                      </span>
                      {o.isTest && (
                        <Badge variant="outline" className="text-orange-400 border-orange-400/50 text-[10px]">
                          TEST
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-[10px] ${statusColor(o.fulfillmentStatus)}`}>
                        {STATUSES.find((s) => s.value === o.fulfillmentStatus)?.label || o.fulfillmentStatus}
                      </Badge>
                      {o.language && (
                        <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                          {LANG_LABEL[o.language] || o.language.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <div className="text-foreground font-medium mt-1">
                      {o.name || "—"}
                    </div>
                    <div className="text-sm text-muted-foreground">{o.email}</div>
                    {o.phone && (
                      <div className="text-sm text-muted-foreground">{o.phone}</div>
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
                    <div className="text-foreground">{formatAddress(o.address)}</div>
                    <div className="mt-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
                      Items
                    </div>
                    <ul className="text-foreground space-y-1">
                      {o.items.map((i, idx) => (
                        <li key={idx}>
                          {i.quantity}× {i.name}
                          {i.personalization && (
                            <span className="block text-xs text-primary">✎ Personalization: {i.personalization}</span>
                          )}
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
                      Sub {o.subtotal} · Ship {o.shipping || "—"} · Tax {o.tax || "—"}
                    </div>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => copy(o)}>
                      {copiedId === o.id ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      Copy
                    </Button>
                  </div>
                </div>

                {/* Status controls */}
                <div className="border-t border-border/40 pt-3 grid gap-2 md:grid-cols-[160px_160px_1fr_auto] items-center">
                  <Select value={draft.status} onValueChange={(v) => updateDraft(o.id, { status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={draft.carrier || "none"}
                    onValueChange={(v) => updateDraft(o.id, { carrier: v === "none" ? "" : v })}
                    disabled={draft.status !== "shipped"}
                  >
                    <SelectTrigger><SelectValue placeholder="Carrier" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No carrier</SelectItem>
                      {CARRIERS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Tracking number"
                    value={draft.trackingNumber}
                    onChange={(e) => updateDraft(o.id, { trackingNumber: e.target.value })}
                    disabled={draft.status !== "shipped"}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveStatus(o, false)}
                      disabled={savingId === o.id || o.isTest}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveStatus(o, true)}
                      disabled={
                        savingId === o.id ||
                        o.isTest ||
                        (draft.status !== "in_process" && draft.status !== "shipped")
                      }
                    >
                      {savingId === o.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Mail className="h-3 w-3 mr-1" />
                      )}
                      Save & email
                    </Button>
                  </div>
                </div>
                {draft.carrier === "other" && draft.status === "shipped" && (
                  <Input
                    placeholder="Carrier name (shown to the customer)"
                    value={draft.carrierName}
                    onChange={(e) => updateDraft(o.id, { carrierName: e.target.value })}
                    className="mt-2"
                  />
                )}
                {o.isTest && (
                  <div className="text-[11px] text-orange-400/80">
                    Test order — status updates and emails are disabled.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
