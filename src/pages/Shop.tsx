import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { RichTextContent } from '@/components/RichTextContent';
import AppShell from '@/components/mobile/AppShell';

const stripe = 'repeating-linear-gradient(135deg,#1b1b1f 0 7px,#131316 7px 14px)';
const money = (cents: number | null) => (cents == null ? '' : `$${(cents / 100).toFixed(2)}`);

interface Product {
  id: string; title: string; image: string | null; price_cents: number | null; tags?: string[];
  description?: string; images?: string[]; variants?: { id: number; title: string; price: number }[];
}
interface CartLine { product: Product; variant: { id: number; title: string; price: number } }

const Shop = () => {
  const { t } = useLanguage();
  const [view, setView] = useState<'shop' | 'product' | 'cart' | 'done'>('shop');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.functions.invoke('printify', { body: { action: 'products' } });
      setProducts(((data as { products?: Product[] })?.products) ?? []);
      setLoading(false);
    })();
  }, []);

  const openProduct = async (p: Product) => {
    setSelected(p); setVariantId(null); setView('product');
    const { data } = await supabase.functions.invoke('printify', { body: { action: 'product', id: p.id } });
    const full = (data as { product?: Product })?.product;
    if (full) { setSelected(full); setVariantId(full.variants?.[0]?.id ?? null); }
  };

  const variant = selected?.variants?.find((v) => v.id === variantId) ?? selected?.variants?.[0] ?? null;
  const subtotal = cart.reduce((s, l) => s + l.variant.price, 0);

  return (
    <AppShell wide>
      {/* SHOP */}
      {view === 'shop' && (
        <div className="pt-14">
          <div className="flex items-end justify-between px-5 pb-[18px]">
            <div className="flex flex-col gap-2">
              <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">{t('shop.nowOpen')}</span>
              <span className="font-display text-[30px] uppercase">{t('shop.store')}</span>
            </div>
            <button onClick={() => setView('cart')} className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/[0.14]">
              <span className="font-sans text-[11px] font-medium text-foreground/80">{t('shop.bag')}</span>
              {cart.length > 0 && <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-primary px-1 font-sans text-[10px] font-bold text-[#070708]">{cart.length}</span>}
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4 px-5 lg:mx-auto lg:max-w-[1180px] lg:grid-cols-4 lg:gap-6">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-[176px] animate-pulse rounded-xl bg-white/[0.05]" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center gap-3.5 px-[30px] py-[70px] text-center">
              <img src="/logo.png" alt="" className="h-[52px] w-auto opacity-50" />
              <span className="font-display text-[20px] uppercase">{t('shop.soon')}</span>
              <span className="font-sans text-[12.5px] leading-[1.6] text-foreground/50">{t('shop.soonDesc')}</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 px-5 lg:mx-auto lg:max-w-[1180px] lg:grid-cols-4 lg:gap-6">
              {products.map((p) => (
                <button key={p.id} onClick={() => openProduct(p)} className="flex flex-col gap-2 text-left">
                  <div className="relative flex h-[176px] items-end justify-center overflow-hidden rounded-xl" style={{ background: p.image ? undefined : stripe }}>
                    {p.image && <img src={p.image} alt={p.title} className="h-full w-full object-cover" />}
                  </div>
                  <span className="font-sans text-[12.5px] font-medium leading-[1.3]">{p.title}</span>
                  <span className="font-sans text-[12px] text-primary">{money(p.price_cents)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PRODUCT */}
      {view === 'product' && selected && (
        <div className="pb-28">
          <div className="relative flex h-[400px] items-center justify-center overflow-hidden" style={{ background: selected.image ? undefined : stripe }}>
            {selected.image && <img src={selected.image} alt={selected.title} className="h-full w-full object-cover" />}
            <button onClick={() => setView('shop')} className="absolute left-4 top-[52px] flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#070708]/65 font-display text-[15px]">←</button>
          </div>
          <div className="flex flex-col gap-[18px] px-5 pt-[22px]">
            <div className="flex flex-col gap-2">
              <span className="font-display text-[26px] uppercase leading-[1.05]">{selected.title}</span>
              <span className="font-sans text-[16px] font-medium">{money(variant?.price ?? selected.price_cents)}</span>
            </div>
            {selected.description && <RichTextContent html={selected.description} className="font-sans text-[13.5px] leading-[1.65] text-foreground/60 [&_p]:mb-2" />}
            {selected.variants && selected.variants.length > 1 && (
              <div className="flex flex-col gap-2.5">
                <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/45">{t('shop.size')}</span>
                <div className="flex flex-wrap gap-2">
                  {selected.variants.map((v) => (
                    <button key={v.id} onClick={() => setVariantId(v.id)} className="flex h-[42px] min-w-[46px] items-center justify-center rounded-[10px] px-3 font-sans text-[12.5px] font-medium"
                      style={variantId === v.id ? { background: '#f4f2ee', color: '#070708' } : { border: '1px solid rgba(255,255,255,.14)', color: 'rgba(244,242,238,.75)' }}>{v.title}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="fixed inset-x-0 bottom-[76px] left-1/2 z-30 flex w-full max-w-[520px] -translate-x-1/2 items-center gap-3 px-5 pb-4 pt-3" style={{ background: 'linear-gradient(to top,#070708 55%,rgba(7,7,8,0))' }}>
            <button onClick={() => { if (variant) { setCart((c) => [...c, { product: selected, variant }]); setView('shop'); } }} className="flex h-[52px] flex-1 items-center justify-center rounded-full font-sans text-[13.5px] font-bold tracking-[0.04em] text-[#070708]" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>{t('shop.add')} · {money(variant?.price ?? selected.price_cents)}</button>
            <button onClick={() => setView('cart')} className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-white/[0.16] font-sans text-[11px] text-foreground/75">{cart.length}</button>
          </div>
        </div>
      )}

      {/* CART */}
      {view === 'cart' && (
        <div className="pt-14">
          <div className="flex items-center gap-3 px-4 pb-5">
            <button onClick={() => setView('shop')} className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/[0.12] font-display text-[15px]">←</button>
            <span className="font-display text-[22px] uppercase">{t('shop.yourBag')}</span>
          </div>
          {cart.length > 0 ? (
            <div>
              {cart.map((l, i) => (
                <div key={i} className="flex gap-3.5 border-t border-white/[0.06] px-5 py-3.5">
                  <div className="h-[74px] w-16 flex-none overflow-hidden rounded-lg" style={{ background: l.product.image ? undefined : stripe }}>{l.product.image && <img src={l.product.image} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <span className="font-sans text-[13px] font-medium leading-[1.3]">{l.product.title}</span>
                    <span className="font-sans text-[11px] text-foreground/40">{l.variant.title}</span>
                    <span className="font-sans text-[12.5px] text-primary">{money(l.variant.price)}</span>
                  </div>
                </div>
              ))}
              <div className="m-5 flex flex-col gap-2.5 rounded-2xl border border-white/[0.07] bg-[#101012] p-4">
                <div className="flex justify-between font-sans text-[12.5px] text-foreground/60"><span>{t('shop.subtotal')}</span><span>{money(subtotal)}</span></div>
                <div className="flex justify-between font-sans text-[12.5px] text-foreground/60"><span>{t('shop.shipping')}</span><span>$0.00</span></div>
                <div className="h-px bg-white/[0.07]" />
                <div className="flex items-baseline justify-between"><span className="font-sans text-[13px] font-semibold">{t('shop.total')}</span><span className="font-display text-[20px] text-primary">{money(subtotal)}</span></div>
              </div>
              <button onClick={() => { setView('done'); setCart([]); }} className="mx-5 flex h-[52px] w-[calc(100%-40px)] items-center justify-center rounded-full font-sans text-[13.5px] font-bold tracking-[0.04em] text-[#070708]" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>{t('shop.checkout')}</button>
              <div className="mt-3.5 text-center font-sans text-[11px] text-foreground/35">{t('shop.secure')}</div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3.5 px-[30px] py-[60px] text-center">
              <img src="/logo.png" alt="" className="h-[52px] w-auto opacity-50" />
              <span className="font-sans text-[15px] font-semibold">{t('shop.empty')}</span>
              <button onClick={() => setView('shop')} className="mt-1.5 rounded-full border border-primary/50 px-5 py-3 font-sans text-[12px] font-semibold text-primary">{t('shop.browse')}</button>
            </div>
          )}
        </div>
      )}

      {/* DONE */}
      {view === 'done' && (
        <div className="flex min-h-[80dvh] flex-col items-center justify-center gap-4 px-[34px] text-center">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full font-display text-[26px] text-[#070708]" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>✓</div>
          <span className="font-display text-[26px] uppercase leading-[1.05]">{t('shop.confirmed')}</span>
          <span className="font-sans text-[13px] leading-[1.6] text-foreground/55">{t('shop.confirmedDesc')}</span>
          <button onClick={() => setView('shop')} className="mt-2 rounded-full border border-white/[0.16] px-[22px] py-[13px] font-sans text-[12.5px] font-semibold">{t('shop.backStore')}</button>
        </div>
      )}
    </AppShell>
  );
};

export default Shop;
