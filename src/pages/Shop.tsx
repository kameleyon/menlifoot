import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import AppShell from '@/components/mobile/AppShell';

const stripe = 'repeating-linear-gradient(135deg,#1b1b1f 0 7px,#131316 7px 14px)';
const FILTERS = ['shop.fAll', 'shop.fApparel', 'shop.fCaps', 'shop.fAccessories'];
const PRODUCTS = [
  { name: 'Grenadier Home Tee', price: '$42', limited: true, tag: 'Apparel · launch drop' },
  { name: 'Gold Mark Cap', price: '$34', limited: false, tag: 'Caps' },
  { name: 'Podcast Crewneck', price: '$68', limited: true, tag: 'Apparel' },
  { name: 'Les Grenadiers Scarf', price: '$28', limited: false, tag: 'Accessories' },
  { name: 'Mark Tote', price: '$24', limited: false, tag: 'Accessories' },
  { name: 'Away Training Tee', price: '$46', limited: false, tag: 'Apparel' },
];
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

const Shop = () => {
  const { t } = useLanguage();
  const [view, setView] = useState<'shop' | 'product' | 'cart' | 'done'>('shop');
  const [active, setActive] = useState(0);
  const [cart, setCart] = useState(0);
  const [selected, setSelected] = useState<typeof PRODUCTS[number] | null>(null);
  const [size, setSize] = useState('M');

  const openProduct = (p: typeof PRODUCTS[number]) => { setSelected(p); setView('product'); };

  return (
    <AppShell>
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
              {cart > 0 && <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-primary px-1 font-sans text-[10px] font-bold text-[#070708]">{cart}</span>}
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto px-5 pb-[18px] [scrollbar-width:none]">
            {FILTERS.map((f, i) => (
              <button key={f} onClick={() => setActive(i)} className="flex-none rounded-full px-[13px] py-2 font-sans text-[11px] font-medium"
                style={active === i ? { background: '#f4f2ee', color: '#070708' } : { border: '1px solid rgba(255,255,255,.14)', color: 'rgba(244,242,238,.7)' }}>{t(f)}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 px-5">
            {PRODUCTS.map((p) => (
              <button key={p.name} onClick={() => openProduct(p)} className="flex flex-col gap-2 text-left">
                <div className="relative flex h-[176px] items-end justify-center rounded-xl pb-2.5" style={{ background: stripe }}>
                  <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-foreground/30">product shot</span>
                  {p.limited && <span className="absolute left-2.5 top-2.5 rounded-full bg-primary px-[7px] py-1 font-sans text-[8px] font-bold uppercase tracking-[0.14em] text-[#070708]">{t('shop.limited')}</span>}
                </div>
                <span className="font-sans text-[12.5px] font-medium leading-[1.3]">{p.name}</span>
                <span className="font-sans text-[12px] text-primary">{p.price}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PRODUCT */}
      {view === 'product' && selected && (
        <div className="pb-28">
          <div className="relative flex h-[400px] items-center justify-center" style={{ background: stripe }}>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-foreground/30">product shot 1:1</span>
            <button onClick={() => setView('shop')} className="absolute left-4 top-[52px] flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#070708]/65 font-display text-[15px]">←</button>
          </div>
          <div className="flex flex-col gap-[18px] px-5 pt-[22px]">
            <div className="flex flex-col gap-2">
              <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">{selected.tag}</span>
              <span className="font-display text-[26px] uppercase leading-[1.05]">{selected.name}</span>
              <span className="font-sans text-[16px] font-medium">{selected.price}</span>
            </div>
            <p className="m-0 font-sans text-[13.5px] leading-[1.65] text-foreground/60">Heavyweight cotton, embroidered gold mark at the chest. Cut boxy — size down for a closer fit.</p>
            <div className="flex flex-col gap-2.5">
              <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/45">{t('shop.size')}</span>
              <div className="flex gap-2">
                {SIZES.map((s) => (
                  <button key={s} onClick={() => setSize(s)} className="flex h-[42px] w-[46px] items-center justify-center rounded-[10px] font-sans text-[12.5px] font-medium"
                    style={size === s ? { background: '#f4f2ee', color: '#070708' } : { border: '1px solid rgba(255,255,255,.14)', color: 'rgba(244,242,238,.75)' }}>{s}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="fixed inset-x-0 bottom-[76px] left-1/2 z-30 flex w-full max-w-[520px] -translate-x-1/2 items-center gap-3 px-5 pb-4 pt-3" style={{ background: 'linear-gradient(to top,#070708 55%,rgba(7,7,8,0))' }}>
            <button onClick={() => { setCart((c) => c + 1); setView('shop'); }} className="flex h-[52px] flex-1 items-center justify-center rounded-full font-sans text-[13.5px] font-bold tracking-[0.04em] text-[#070708]" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>{t('shop.add')} · {selected.price}</button>
            <button onClick={() => setView('cart')} className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-white/[0.16] font-sans text-[11px] text-foreground/75">{cart}</button>
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
          {cart > 0 ? (
            <div>
              {Array.from({ length: cart }).map((_, i) => (
                <div key={i} className="flex gap-3.5 border-t border-white/[0.06] px-5 py-3.5">
                  <div className="h-[74px] w-16 flex-none rounded-lg" style={{ background: stripe }} />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <span className="font-sans text-[13px] font-medium leading-[1.3]">{selected?.name ?? 'Grenadier Home Tee'}</span>
                    <span className="font-sans text-[11px] text-foreground/40">Size {size}</span>
                    <span className="font-sans text-[12.5px] text-primary">{selected?.price ?? '$42'}</span>
                  </div>
                </div>
              ))}
              <div className="m-5 flex flex-col gap-2.5 rounded-2xl border border-white/[0.07] bg-[#101012] p-4">
                <div className="flex justify-between font-sans text-[12.5px] text-foreground/60"><span>{t('shop.subtotal')}</span><span>${cart * 42}.00</span></div>
                <div className="flex justify-between font-sans text-[12.5px] text-foreground/60"><span>{t('shop.shipping')}</span><span>$0.00</span></div>
                <div className="h-px bg-white/[0.07]" />
                <div className="flex items-baseline justify-between"><span className="font-sans text-[13px] font-semibold">{t('shop.total')}</span><span className="font-display text-[20px] text-primary">${cart * 42}.00</span></div>
              </div>
              <button onClick={() => { setView('done'); setCart(0); }} className="mx-5 flex h-[52px] w-[calc(100%-40px)] items-center justify-center rounded-full font-sans text-[13.5px] font-bold tracking-[0.04em] text-[#070708]" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>{t('shop.checkout')}</button>
              <div className="mt-3.5 text-center font-sans text-[11px] text-foreground/35">{t('shop.secure')}</div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3.5 px-[30px] py-[60px] text-center">
              <img src="/logo.png" alt="" className="h-[52px] w-auto opacity-50" />
              <span className="font-sans text-[15px] font-semibold">{t('shop.empty')}</span>
              <span className="font-sans text-[12.5px] leading-[1.6] text-foreground/50">{t('shop.emptyDesc')}</span>
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
