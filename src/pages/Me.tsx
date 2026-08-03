import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/mobile/AppShell';

const LANGS: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' }, { code: 'fr', label: 'FR' }, { code: 'es', label: 'ES' }, { code: 'ht', label: 'HT' },
];

interface OrderItem { name: string; quantity: number; personalization?: string | null }
interface MyOrder {
  reference: string; createdAt: string; total: string; items: OrderItem[];
  status: string; trackingNumber: string | null; carrier: string | null; carrierName: string | null;
}

// Fulfillment status → { label key, color }. Mirrors the shop admin statuses.
const STATUS = (t: (k: string) => string): Record<string, { label: string; cls: string }> => ({
  new: { label: t('order.processing'), cls: 'bg-white/10 text-foreground/70' },
  in_process: { label: t('order.preparing'), cls: 'bg-blue-500/20 text-blue-300' },
  shipped: { label: t('order.shipped'), cls: 'bg-primary/20 text-primary' },
  delivered: { label: t('order.delivered'), cls: 'bg-green-500/20 text-green-300' },
  canceled: { label: t('order.canceled'), cls: 'bg-red-500/20 text-red-300' },
});

const trackUrl = (carrier: string | null, num: string | null) => {
  if (!num) return null;
  const t = encodeURIComponent(num);
  switch (carrier) {
    case 'canada_post': return `https://www.canadapost-postescanada.ca/track-reperage/en#/details/${t}`;
    case 'ups': return `https://www.ups.com/track?tracknum=${t}`;
    case 'fedex': return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
    case 'usps': return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    case 'amazon': return `https://track.amazon.com/tracking/${t}`;
    default: return null;
  }
};

const Me = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { user, signOut } = useAuth();
  const email = user?.email ?? null;
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (!user) { setLoadingOrders(false); return; }
    (async () => {
      const { data } = await supabase.functions.invoke('my-orders');
      setOrders(((data as { orders?: MyOrder[] })?.orders) ?? []);
      setLoadingOrders(false);
    })();
  }, [user]);

  const name = email ? email.split('@')[0] : 'Guest';
  const statusMap = STATUS(t);

  return (
    <AppShell>
      <div className="mx-auto max-w-[640px] pt-14">
        {/* Profile */}
        <div className="flex items-center gap-4 px-5 pb-[22px]">
          <div className="h-16 w-16 rounded-full border border-white/10" style={{ background: 'repeating-linear-gradient(135deg,#1c1c20 0 6px,#141417 6px 12px)' }} />
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-[22px] uppercase">{name}</span>
            <span className="font-sans text-[11.5px] text-foreground/45">{email ? `${t('me.member')} · ${email}` : t('me.notSignedIn')}</span>
          </div>
        </div>

        {/* Saved articles */}
        <button onClick={() => navigate('/articles')} className="flex w-full items-center justify-between border-t border-white/[0.06] px-5 py-4 text-left transition-colors hover:bg-white/[0.03]">
          <span className="font-sans text-[13.5px] font-medium">{t('me.savedArticles')}</span>
          <span className="font-sans text-[12px] text-foreground/40">→</span>
        </button>

        {/* Order history */}
        <div className="border-t border-white/[0.06] px-5 py-4">
          <span className="font-sans text-[13.5px] font-medium">{t('me.orders')}</span>
          {loadingOrders ? (
            <p className="mt-3 font-sans text-[12px] text-foreground/40">…</p>
          ) : orders.length === 0 ? (
            <p className="mt-3 font-sans text-[12px] text-foreground/40">{t('me.noOrders')}</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {orders.map((o) => {
                const s = statusMap[o.status] ?? statusMap.new;
                const url = o.status === 'shipped' ? trackUrl(o.carrier, o.trackingNumber) : null;
                return (
                  <div key={o.reference} className="rounded-xl border border-white/[0.07] bg-[#101012] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-primary">{o.reference}</span>
                      <span className={`rounded-full px-2 py-[3px] font-sans text-[10px] font-semibold ${s.cls}`}>{s.label}</span>
                    </div>
                    <div className="mt-1.5 font-sans text-[11px] text-foreground/40">
                      {new Date(o.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} · {o.total}
                    </div>
                    <ul className="mt-2 flex flex-col gap-0.5">
                      {o.items.map((it, i) => (
                        <li key={i} className="font-sans text-[12.5px] text-foreground/75">
                          {it.quantity}× {it.name}
                          {it.personalization && <span className="text-primary/85"> · {it.personalization}</span>}
                        </li>
                      ))}
                    </ul>
                    {o.status === 'shipped' && o.trackingNumber && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="text-foreground/50">{t('order.tracking')}:</span>
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">{o.trackingNumber}</a>
                        ) : (
                          <span className="font-medium text-foreground/80">{o.trackingNumber}</span>
                        )}
                        {(o.carrierName || o.carrier) && <span className="text-foreground/40">({o.carrierName || o.carrier})</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Language switcher */}
        <div className="flex w-full items-center justify-between border-t border-white/[0.06] px-5 py-4">
          <span className="font-sans text-[13.5px] font-medium">{t('me.language')}</span>
          <span className="flex gap-1.5">
            {LANGS.map((l) => (
              <button key={l.code} onClick={() => setLanguage(l.code)} className={`rounded px-1.5 py-0.5 font-sans text-[11px] font-semibold transition-colors ${l.code === language ? 'bg-primary text-[#070708]' : 'text-foreground/35 hover:text-foreground'}`}>{l.label}</button>
            ))}
          </span>
        </div>

        {/* Sign in / out */}
        <button onClick={() => (email ? signOut().then(() => navigate('/')) : navigate('/auth'))} className="flex w-full items-center justify-between border-t border-b border-white/[0.06] px-5 py-4 text-left transition-colors hover:bg-white/[0.03]">
          <span className="font-sans text-[13.5px] font-medium">{email ? t('me.signOut') : t('me.signIn')}</span>
          <span className="font-sans text-[12px] text-foreground/40">→</span>
        </button>
      </div>
    </AppShell>
  );
};

export default Me;
