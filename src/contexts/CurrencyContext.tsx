import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface Geo { currency: string; symbol: string; rate: number }
interface CurrencyValue {
  currency: string;
  rate: number;
  /** Format USD cents as "$X.XX", plus "· ≈ <local>" when the visitor isn't in a USD country. */
  fmt: (cents: number | null | undefined) => string;
}

const Ctx = createContext<CurrencyValue | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [geo, setGeo] = useState<Geo>({ currency: 'USD', symbol: '$', rate: 1 });

  useEffect(() => {
    let alive = true;
    fetch('/api/geo')
      .then((r) => r.json())
      .then((d) => { if (alive && d && d.currency) setGeo({ currency: d.currency, symbol: d.symbol || '', rate: Number(d.rate) || 1 }); })
      .catch(() => { /* keep USD default */ });
    return () => { alive = false; };
  }, []);

  const fmt = (cents: number | null | undefined) => {
    if (cents == null) return '';
    const usd = cents / 100;
    const base = `$${usd.toFixed(2)}`;
    if (geo.currency === 'USD' || geo.rate === 1) return base;
    let local: string;
    try {
      // Force en-US so the currency SYMBOL is prefixed (e.g. "CA$54.99", "€54.99"),
      // not the visitor's locale which can render CAD as "54,99 $".
      local = new Intl.NumberFormat('en-US', { style: 'currency', currency: geo.currency }).format(usd * geo.rate);
    } catch {
      local = `${geo.symbol}${(usd * geo.rate).toFixed(2)}`;
    }
    return `${base} · ≈ ${local}`;
  };

  return <Ctx.Provider value={{ currency: geo.currency, rate: geo.rate, fmt }}>{children}</Ctx.Provider>;
};

export const useCurrency = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCurrency must be used within CurrencyProvider');
  return c;
};
