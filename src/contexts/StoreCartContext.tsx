import { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction, useMemo } from 'react';

export interface Color { id: number; title: string; hex: string | null }
export interface Size { id: number; title: string }
export interface Variant { id: number; title: string; price: number; options: number[] }
export interface Img { src: string; variant_ids: number[] }
export interface Product {
  id: string; title: string; image: string | null; price_cents: number | null; tags?: string[]; personalize?: boolean;
  description?: string; images?: Img[]; colors?: Color[]; sizes?: Size[]; variants?: Variant[];
}
export interface CartLine { product: Product; variant: Variant; qty: number; personalization?: string }

interface StoreCartValue {
  cart: CartLine[];
  setCart: Dispatch<SetStateAction<CartLine[]>>;
  count: number;
}

const Ctx = createContext<StoreCartValue | undefined>(undefined);

export const StoreCartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartLine[]>([]);
  const count = useMemo(() => cart.reduce((n, l) => n + l.qty, 0), [cart]);
  return <Ctx.Provider value={{ cart, setCart, count }}>{children}</Ctx.Provider>;
};

export const useStoreCart = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStoreCart must be used within StoreCartProvider');
  return c;
};
