import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { RichTextContent } from '@/components/RichTextContent';
import AppShell from '@/components/mobile/AppShell';

const stripe = 'repeating-linear-gradient(135deg,#1b1b1f 0 7px,#131316 7px 14px)';
const money = (cents: number | null) => (cents == null ? '' : `$${(cents / 100).toFixed(2)}`);
// Infer a customer-facing category from the product title (Printify's v1 API has no clean category field).
const categoryOf = (p: { title: string }) => {
  const t = p.title.toLowerCase();
  if (/hoodie|sweatshirt|crewneck/.test(t)) return 'Hoodies';
  if (/beanie/.test(t)) return 'Beanies';
  if (/cap|hat|snapback|trucker/.test(t)) return 'Hats';
  if (/tank/.test(t)) return 'Tanks';
  if (/tee|t-shirt|tshirt| shirt/.test(t)) return 'T-Shirts';
  if (/mug|bottle|cup|tumbler/.test(t)) return 'Drinkware';
  if (/bag|tote|backpack/.test(t)) return 'Bags';
  return 'Other';
};
const EMPTY_ADDR = { first_name: '', last_name: '', email: '', phone: '', country: 'US', region: '', address1: '', address2: '', city: '', zip: '' };

interface Color { id: number; title: string; hex: string | null }
interface Size { id: number; title: string }
interface Variant { id: number; title: string; price: number; options: number[] }
interface Img { src: string; variant_ids: number[] }
interface Product {
  id: string; title: string; image: string | null; price_cents: number | null; tags?: string[]; personalize?: boolean;
  description?: string; images?: Img[]; colors?: Color[]; sizes?: Size[]; variants?: Variant[];
}
interface CartLine { product: Product; variant: Variant; qty: number; personalization?: string }

const Field = ({ label, value, onChange, className = '' }: { label: string; value: string; onChange: (v: string) => void; className?: string }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <label className="font-sans text-[10px] uppercase tracking-wide text-foreground/40">{label}</label>
    <input value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl border border-white/[0.12] bg-[#101012] px-3.5 py-2.5 font-sans text-[14px] text-foreground focus:border-primary/50 focus:outline-none" />
  </div>
);

const Shop = () => {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<'shop' | 'product' | 'cart' | 'address' | 'done'>('shop');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [colorId, setColorId] = useState<number | null>(null);
  const [sizeId, setSizeId] = useState<number | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [personalization, setPersonalization] = useState('');
  const [pqty, setPqty] = useState(1);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState('featured');
  const [address, setAddress] = useState({ ...EMPTY_ADDR });
  const [placing, setPlacing] = useState(false);

  // React to ?checkout=success / ?cart=1 even when already on the shop page (e.g. top-bar bag click).
  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setView('done'); setCart([]); setSearchParams({}, { replace: true });
    } else if (searchParams.get('cart') === '1') {
      setView('cart'); setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.functions.invoke('printify', { body: { action: 'products' } });
      setProducts(((data as { products?: Product[] })?.products) ?? []);
      setLoading(false);
    })();
  }, []);

  // color/size lookups (variant.options order isn't fixed — match ids against each set)
  const colorIds = useMemo(() => new Set((selected?.colors ?? []).map((c) => c.id)), [selected]);
  const sizeIds = useMemo(() => new Set((selected?.sizes ?? []).map((s) => s.id)), [selected]);
  const vColor = (v: Variant) => v.options.find((id) => colorIds.has(id));
  const vSize = (v: Variant) => v.options.find((id) => sizeIds.has(id));
  const variants = selected?.variants ?? [];

  const availColors = useMemo(() => {
    const used = new Set(variants.map(vColor).filter(Boolean));
    return (selected?.colors ?? []).filter((c) => used.has(c.id));
  }, [selected]);
  const availSizes = useMemo(() => {
    const sizesForColor = new Set(variants.filter((v) => vColor(v) === colorId).map(vSize));
    return (selected?.sizes ?? []).filter((s) => sizesForColor.has(s.id));
  }, [selected, colorId]);
  const variant = useMemo(() => variants.find((v) => vColor(v) === colorId && vSize(v) === sizeId) ?? null, [selected, colorId, sizeId]);
  const gallery = useMemo(() => {
    const ids = new Set(variants.filter((v) => vColor(v) === colorId).map((v) => v.id));
    const imgs = (selected?.images ?? []).filter((im) => im.variant_ids.some((id) => ids.has(id)));
    return imgs.length ? imgs : (selected?.images ?? []);
  }, [selected, colorId]);

  const openProduct = async (p: Product) => {
    setSelected(p); setColorId(null); setSizeId(null); setImgIdx(0); setPersonalization(''); setPqty(1); setView('product');
    const { data } = await supabase.functions.invoke('printify', { body: { action: 'product', id: p.id } });
    const full = (data as { product?: Product })?.product;
    if (!full) return;
    setSelected(full);
    const cIds = new Set((full.colors ?? []).map((c) => c.id));
    const sIds = new Set((full.sizes ?? []).map((s) => s.id));
    const vc = (v: Variant) => v.options.find((id) => cIds.has(id));
    const vsz = (v: Variant) => v.options.find((id) => sIds.has(id));
    const firstColor = (full.colors ?? []).find((c) => (full.variants ?? []).some((v) => vc(v) === c.id))?.id ?? null;
    const firstSize = (full.sizes ?? []).find((s) => (full.variants ?? []).some((v) => vc(v) === firstColor && vsz(v) === s.id))?.id ?? null;
    setColorId(firstColor); setSizeId(firstSize); setImgIdx(0);
  };

  const pickColor = (id: number) => {
    setColorId(id); setImgIdx(0);
    const firstSize = (selected?.sizes ?? []).find((s) => variants.some((v) => vColor(v) === id && vSize(v) === s.id))?.id ?? null;
    setSizeId(firstSize);
  };

  const subtotal = cart.reduce((s, l) => s + l.variant.price * l.qty, 0);
  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const removeLine = (i: number) => setCart((c) => c.filter((_, idx) => idx !== i));
  const setQty = (i: number, delta: number) =>
    setCart((c) => c.map((l, idx) => (idx === i ? { ...l, qty: Math.max(1, Math.min(20, l.qty + delta)) } : l)));
  const addToCart = (product: Product, variant: Variant, note?: string, quantity = 1) => {
    const q = Math.max(1, Math.min(20, quantity));
    setCart((c) => {
      // Personalized items are always their own line (each has unique text).
      if (note) return [...c, { product, variant, qty: q, personalization: note }];
      const i = c.findIndex((l) => l.product.id === product.id && l.variant.id === variant.id && !l.personalization);
      if (i >= 0) { const n = [...c]; n[i] = { ...n[i], qty: Math.min(20, n[i].qty + q) }; return n; }
      return [...c, { product, variant, qty: q }];
    });
    setPersonalization('');
    setView('shop');
  };
  const cartProductIds = useMemo(() => new Set(cart.map((l) => l.product.id)), [cart]);
  const similar = useMemo(() => products.filter((p) => !cartProductIds.has(p.id)).slice(0, 6), [products, cartProductIds]);
  const categories = useMemo(() => Array.from(new Set(products.map(categoryOf))).sort(), [products]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter((p) => (!q || p.title.toLowerCase().includes(q)) && (category === 'all' || categoryOf(p) === category));
    list = [...list];
    if (sortBy === 'price-asc') list.sort((a, b) => (a.price_cents ?? 0) - (b.price_cents ?? 0));
    else if (sortBy === 'price-desc') list.sort((a, b) => (b.price_cents ?? 0) - (a.price_cents ?? 0));
    else if (sortBy === 'name') list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [products, query, category, sortBy]);

  const placeOrder = async () => {
    setPlacing(true);
    // Each cart line is already unique (variants merge by qty; personalized lines stay separate).
    const items = cart.map((l) => ({
      product_id: l.product.id, variant_id: l.variant.id, quantity: l.qty,
      ...(l.personalization ? { personalization: l.personalization } : {}),
    }));
    const { data, error } = await supabase.functions.invoke('checkout', { body: { items, address } });
    setPlacing(false);
    const url = (data as { url?: string })?.url;
    if (url) window.location.href = url;
    else alert((data as { error?: string })?.error ?? error?.message ?? 'Checkout failed');
  };
  const addrValid = address.first_name && address.last_name && address.email && address.address1 && address.city && address.country && address.zip;

  return (
    <AppShell wide>
      {/* SHOP */}
      {view === 'shop' && (
        <div className="mx-auto max-w-[1180px] px-5 pt-14 lg:px-10 lg:pt-10">
          <div className="flex items-end justify-between pb-[18px]">
            <div className="flex flex-col gap-2">
              <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">{t('shop.nowOpen')}</span>
              <span className="font-display text-[30px] uppercase lg:text-[42px]">{t('shop.store')}</span>
            </div>
            <button onClick={() => setView('cart')} className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/[0.14] lg:hidden">
              <span className="font-sans text-[11px] font-medium text-foreground/80">{t('shop.bag')}</span>
              {cart.length > 0 && <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-primary px-1 font-sans text-[10px] font-bold text-[#070708]">{cartCount}</span>}
            </button>
          </div>

          {!loading && products.length > 0 && (
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('shop.search')}
                  className="w-full rounded-full border border-white/[0.12] bg-[#101012] py-2.5 pl-10 pr-4 font-sans text-[13px] text-foreground placeholder:text-foreground/35 focus:border-primary/50 focus:outline-none" />
              </div>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-full border border-white/[0.12] bg-[#101012] px-4 py-2.5 font-sans text-[13px] text-foreground focus:border-primary/50 focus:outline-none">
                <option value="all">{t('shop.all')}</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-full border border-white/[0.12] bg-[#101012] px-4 py-2.5 font-sans text-[13px] text-foreground focus:border-primary/50 focus:outline-none">
                <option value="featured">{t('shop.featured')}</option>
                <option value="price-asc">{t('shop.priceLow')}</option>
                <option value="price-desc">{t('shop.priceHigh')}</option>
                <option value="name">{t('shop.nameAz')}</option>
              </select>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-[176px] animate-pulse rounded-xl bg-white/[0.05]" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center gap-3.5 py-[70px] text-center">
              <img src="/logo.png" alt="" className="h-[52px] w-auto opacity-50" />
              <span className="font-display text-[20px] uppercase">{t('shop.soon')}</span>
              <span className="font-sans text-[12.5px] leading-[1.6] text-foreground/50">{t('shop.soonDesc')}</span>
            </div>
          ) : visible.length === 0 ? (
            <p className="py-16 text-center font-sans text-foreground/45">{t('shop.noResults')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
              {visible.map((p) => (
                <button key={p.id} onClick={() => openProduct(p)} className="group flex flex-col gap-2 text-left">
                  <div className="aspect-square w-full overflow-hidden rounded-xl bg-white" style={{ background: p.image ? undefined : stripe }}>
                    {p.image && <img src={p.image} alt={p.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />}
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
        <div className="mx-auto max-w-[1080px] pb-28 lg:px-10 lg:pt-8 lg:pb-16">
          <button onClick={() => setView('shop')} className="absolute left-4 top-[52px] z-10 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#070708]/65 font-display text-[15px] backdrop-blur-md lg:relative lg:left-0 lg:top-0 lg:mb-4">←</button>
        <div className="lg:flex lg:gap-10">
          {/* Gallery */}
          <div className="lg:w-[52%] lg:flex-none">
            <div className="aspect-square w-full overflow-hidden bg-white lg:rounded-2xl" style={{ background: gallery.length ? undefined : stripe }}>
              {gallery[imgIdx] && <img src={gallery[imgIdx].src} alt={selected.title} className="h-full w-full object-cover" />}
            </div>
            {gallery.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto px-5 lg:px-0 [scrollbar-width:none]">
                {gallery.map((im, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} className={`h-16 w-16 flex-none overflow-hidden rounded-lg border bg-white ${i === imgIdx ? 'border-primary' : 'border-white/[0.1]'}`}>
                    <img src={im.src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-1 flex-col gap-[18px] px-5 pt-[22px] lg:px-0 lg:pt-0">
            <div className="flex flex-col gap-2">
              <span className="font-display text-[26px] uppercase leading-[1.05] lg:text-[34px]">{selected.title}</span>
              <span className="font-sans text-[18px] font-medium">{money(variant?.price ?? selected.price_cents)}</span>
            </div>

            {/* Colors */}
            {availColors.length > 1 && (
              <div className="flex flex-col gap-2.5">
                <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/45">{t('shop.color')}: <span className="text-foreground/80">{availColors.find((c) => c.id === colorId)?.title}</span></span>
                <div className="flex flex-wrap gap-2">
                  {availColors.map((c) => (
                    <button key={c.id} onClick={() => pickColor(c.id)} title={c.title}
                      className={`h-8 w-8 rounded-full border-2 transition-transform ${c.id === colorId ? 'border-primary scale-110' : 'border-white/20'}`}
                      style={{ background: c.hex ?? '#888' }} />
                  ))}
                </div>
              </div>
            )}

            {/* Sizes */}
            {availSizes.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/45">{t('shop.size')}</span>
                <div className="flex flex-wrap gap-2">
                  {availSizes.map((s) => (
                    <button key={s.id} onClick={() => setSizeId(s.id)} className="flex h-[42px] min-w-[46px] items-center justify-center rounded-[10px] px-3 font-sans text-[12.5px] font-medium"
                      style={sizeId === s.id ? { background: '#f4f2ee', color: '#070708' } : { border: '1px solid rgba(255,255,255,.14)', color: 'rgba(244,242,238,.75)' }}>{s.title}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Personalization (products the merchant tagged "Personalizable") */}
            {selected.personalize && (
              <div className="flex flex-col gap-2">
                <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-primary">{t('shop.personalize')}</span>
                <input
                  value={personalization} onChange={(e) => setPersonalization(e.target.value)} maxLength={40}
                  placeholder={t('shop.personalizePlaceholder')}
                  className="rounded-xl border border-primary/40 bg-[#101012] px-3.5 py-2.5 font-sans text-[14px] text-foreground focus:border-primary focus:outline-none"
                />
                <span className="font-sans text-[10.5px] text-foreground/40">{t('shop.personalizeHint')}</span>
              </div>
            )}

            {/* Quantity */}
            <div className="flex flex-col gap-2.5">
              <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/45">{t('shop.qty')}</span>
              <div className="flex w-fit items-center rounded-full border border-white/[0.14]">
                <button onClick={() => setPqty((q) => Math.max(1, q - 1))} disabled={pqty <= 1} aria-label="−" className="flex h-9 w-11 items-center justify-center font-sans text-[18px] leading-none text-foreground/70 transition-colors hover:text-primary disabled:opacity-30">−</button>
                <span className="min-w-[30px] text-center font-sans text-[14px] font-medium">{pqty}</span>
                <button onClick={() => setPqty((q) => Math.min(20, q + 1))} aria-label="+" className="flex h-9 w-11 items-center justify-center font-sans text-[18px] leading-none text-foreground/70 transition-colors hover:text-primary">+</button>
              </div>
            </div>

            {selected.description && <RichTextContent html={selected.description} className="font-sans text-[13.5px] leading-[1.65] text-foreground/60 [&_p]:mb-2" />}

            <button onClick={() => { if (variant) addToCart(selected, variant, selected.personalize ? personalization.trim() || undefined : undefined, pqty); }} disabled={!variant}
              className="mt-1 hidden h-[52px] items-center justify-center rounded-full font-sans text-[13.5px] font-bold tracking-[0.04em] text-[#070708] disabled:opacity-40 lg:flex" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>{t('shop.add')} · {money((variant?.price ?? selected.price_cents ?? 0) * pqty)}</button>
          </div>
        </div>

          {/* Mobile sticky add bar */}
          <div className="fixed inset-x-0 bottom-[76px] left-1/2 z-30 flex w-full max-w-[520px] -translate-x-1/2 items-center gap-3 px-5 pb-4 pt-3 lg:hidden" style={{ background: 'linear-gradient(to top,#070708 55%,rgba(7,7,8,0))' }}>
            <button onClick={() => { if (variant) addToCart(selected, variant, selected.personalize ? personalization.trim() || undefined : undefined, pqty); }} disabled={!variant} className="flex h-[52px] flex-1 items-center justify-center rounded-full font-sans text-[13.5px] font-bold tracking-[0.04em] text-[#070708] disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>{t('shop.add')} · {money((variant?.price ?? selected.price_cents ?? 0) * pqty)}</button>
            <button onClick={() => setView('cart')} className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-white/[0.16] font-sans text-[11px] text-foreground/75">{cartCount}</button>
          </div>
        </div>
      )}

      {/* CART */}
      {view === 'cart' && (
        <div className="mx-auto max-w-[720px] pt-14 lg:pt-10">
          <div className="flex items-center gap-3 px-4 pb-5">
            <button onClick={() => setView('shop')} className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/[0.12] font-display text-[15px]">←</button>
            <span className="font-display text-[22px] uppercase">{t('shop.yourBag')}</span>
          </div>
          {cart.length > 0 ? (
            <div>
              {cart.map((l, i) => (
                <div key={i} className="flex gap-3.5 border-t border-white/[0.06] px-5 py-3.5">
                  <div className="h-[74px] w-16 flex-none overflow-hidden rounded-lg bg-white" style={{ background: l.product.image ? undefined : stripe }}>{l.product.image && <img src={l.product.image} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <span className="font-sans text-[13px] font-medium leading-[1.3]">{l.product.title}</span>
                    <span className="font-sans text-[11px] text-foreground/40">{l.variant.title}</span>
                    {l.personalization && <span className="font-sans text-[11px] text-primary/85">✎ {l.personalization}</span>}
                    <div className="mt-1 flex items-center gap-3">
                      <div className="flex items-center rounded-full border border-white/[0.14]">
                        <button onClick={() => setQty(i, -1)} disabled={l.qty <= 1} aria-label="−" className="flex h-7 w-7 items-center justify-center font-sans text-[16px] leading-none text-foreground/70 transition-colors hover:text-primary disabled:opacity-30">−</button>
                        <span className="min-w-[22px] text-center font-sans text-[12.5px] font-medium">{l.qty}</span>
                        <button onClick={() => setQty(i, 1)} aria-label="+" className="flex h-7 w-7 items-center justify-center font-sans text-[16px] leading-none text-foreground/70 transition-colors hover:text-primary">+</button>
                      </div>
                      <span className="font-sans text-[12.5px] text-primary">{money(l.variant.price * l.qty)}</span>
                    </div>
                  </div>
                  <button onClick={() => removeLine(i)} aria-label={t('shop.remove')} className="flex h-8 w-8 flex-none items-center justify-center self-start rounded-full text-foreground/40 transition-colors hover:bg-white/[0.06] hover:text-primary">
                    <X className="h-[17px] w-[17px]" />
                  </button>
                </div>
              ))}
              <div className="m-5 flex flex-col gap-2.5 rounded-2xl border border-white/[0.07] bg-[#101012] p-4">
                <div className="flex justify-between font-sans text-[12.5px] text-foreground/60"><span>{t('shop.subtotal')}</span><span>{money(subtotal)}</span></div>
                <div className="flex justify-between font-sans text-[12.5px] text-foreground/60"><span>{t('shop.shipping')}</span><span>—</span></div>
                <div className="h-px bg-white/[0.07]" />
                <div className="flex items-baseline justify-between"><span className="font-sans text-[13px] font-semibold">{t('shop.total')}</span><span className="font-display text-[20px] text-primary">{money(subtotal)}</span></div>
              </div>
              <button onClick={() => setView('address')} className="mx-5 flex h-[52px] w-[calc(100%-40px)] items-center justify-center rounded-full font-sans text-[13.5px] font-bold tracking-[0.04em] text-[#070708]" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>{t('shop.checkout')}</button>
              <div className="mt-3.5 text-center font-sans text-[11px] text-foreground/35">{t('shop.secure')}</div>

              {similar.length > 0 && (
                <div className="mt-10 px-5 pb-6">
                  <span className="font-display text-[15px] uppercase tracking-[0.04em]">{t('shop.similar')}</span>
                  <div className="mt-3.5 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
                    {similar.map((p) => (
                      <button key={p.id} onClick={() => openProduct(p)} className="w-[130px] flex-none text-left">
                        <div className="aspect-square w-full overflow-hidden rounded-xl bg-white" style={{ background: p.image ? undefined : stripe }}>{p.image && <img src={p.image} alt={p.title} className="h-full w-full object-cover" />}</div>
                        <div className="mt-2 line-clamp-1 font-sans text-[12px] font-medium">{p.title}</div>
                        <div className="mt-0.5 font-sans text-[12px] text-primary">{money(p.price_cents)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

      {/* ADDRESS */}
      {view === 'address' && (
        <div className="mx-auto max-w-[560px] pt-14 lg:pt-10">
          <div className="flex items-center gap-3 px-5 pb-5">
            <button onClick={() => setView('cart')} className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/[0.12] font-display text-[15px]">←</button>
            <span className="font-display text-[22px] uppercase">{t('shop.shippingTo')}</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 px-5 pb-6">
            <Field label={t('shop.firstName')} value={address.first_name} onChange={(v) => setAddress((a) => ({ ...a, first_name: v }))} />
            <Field label={t('shop.lastName')} value={address.last_name} onChange={(v) => setAddress((a) => ({ ...a, last_name: v }))} />
            <Field className="col-span-2" label={t('shop.email')} value={address.email} onChange={(v) => setAddress((a) => ({ ...a, email: v }))} />
            <Field className="col-span-2" label={t('shop.phone')} value={address.phone} onChange={(v) => setAddress((a) => ({ ...a, phone: v }))} />
            <Field className="col-span-2" label={t('shop.address')} value={address.address1} onChange={(v) => setAddress((a) => ({ ...a, address1: v }))} />
            <Field className="col-span-2" label={t('shop.address2')} value={address.address2} onChange={(v) => setAddress((a) => ({ ...a, address2: v }))} />
            <Field label={t('shop.city')} value={address.city} onChange={(v) => setAddress((a) => ({ ...a, city: v }))} />
            <Field label={t('shop.zip')} value={address.zip} onChange={(v) => setAddress((a) => ({ ...a, zip: v }))} />
            <Field label={t('shop.region')} value={address.region} onChange={(v) => setAddress((a) => ({ ...a, region: v }))} />
            <Field label={t('shop.country')} value={address.country} onChange={(v) => setAddress((a) => ({ ...a, country: v }))} />
          </div>
          <button onClick={placeOrder} disabled={!addrValid || placing}
            className="mx-5 flex h-[52px] w-[calc(100%-40px)] items-center justify-center rounded-full font-sans text-[13.5px] font-bold tracking-[0.04em] text-[#070708] disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>{placing ? '…' : t('shop.pay')}</button>
          <div className="mt-3.5 text-center font-sans text-[11px] text-foreground/35">{t('shop.secure')}</div>
        </div>
      )}

      {/* DONE */}
      {view === 'done' && (
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-[34px] text-center">
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
