import { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import jerseyBlackFront from "@/assets/jersey-black-front.jpeg";
import jerseyBlackBack from "@/assets/jersey-black-back.jpeg";
import jerseyWhiteFront from "@/assets/jersey-white-front.jpeg";
import jerseyWhiteBack from "@/assets/jersey-white-back.jpeg";

type Gender = "male" | "female" | "kid";
type Size = "S" | "M" | "L" | "XL";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "kid", label: "Kid" },
];
const SIZES: Size[] = ["S", "M", "L", "XL"];

const PREORDER_PRICE = 75;
const RETAIL_PRICE = 95;
const PREORDER_DEADLINE = "May 30, 2026";

const products = [
  {
    id: "jersey-black",
    name: "Menlifoot Jersey — Black",
    front: jerseyBlackFront,
    back: jerseyBlackBack,
  },
  {
    id: "jersey-white",
    name: "Menlifoot Jersey — White",
    front: jerseyWhiteFront,
    back: jerseyWhiteBack,
  },
];

const JerseyCard = ({ product }: { product: (typeof products)[number] }) => {
  const [view, setView] = useState<"front" | "back">("front");
  const [gender, setGender] = useState<Gender>("male");
  const [size, setSize] = useState<Size>("M");
  const { addToCart, openCart } = useCart();

  const handleAdd = () => {
    const lineId = `${product.id}-${gender}-${size}`;
    const genderLabel = GENDERS.find((g) => g.value === gender)?.label ?? gender;
    addToCart({
      id: lineId,
      productId: product.id,
      name: product.name,
      variant: `${genderLabel} · ${size} · Pre-order`,
      price: PREORDER_PRICE,
      image: product.front,
    });
    toast.success("Added to cart", { duration: 1500, position: "top-center" });
    openCart();
  };

  return (
    <div className="glass-card overflow-hidden hover-lift border border-border/60">
      <div className="relative aspect-square overflow-hidden bg-surface group">
        <img
          src={view === "front" ? product.front : product.back}
          alt={`${product.name} ${view}`}
          className="w-full h-full object-contain p-6 transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute top-4 left-4 flex gap-1 bg-background/80 backdrop-blur-md rounded-full p-1 border border-border/40">
          {(["front", "back"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-[10px] uppercase tracking-[0.15em] px-3 py-1 rounded-full transition-colors ${
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="absolute top-4 right-4 inline-flex items-center gap-1 bg-primary text-primary-foreground text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 rounded-full font-semibold">
          <Sparkles className="h-3 w-3" />
          Pre-order
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div>
          <h3
            className="font-light tracking-wide text-foreground text-xl leading-tight uppercase"
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
            {product.name}
          </h3>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-primary">
              ${PREORDER_PRICE}
            </span>
            <span className="text-sm text-muted-foreground line-through">
              ${RETAIL_PRICE}
            </span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              CAD
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pre-order price until {PREORDER_DEADLINE}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">
              Fit
            </label>
            <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
              <SelectTrigger className="bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">
              Size
            </label>
            <Select value={size} onValueChange={(v) => setSize(v as Size)}>
              <SelectTrigger className="bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button variant="gold" className="w-full" size="lg" onClick={handleAdd}>
          <ShoppingBag className="h-4 w-4 mr-2" />
          Pre-order — ${PREORDER_PRICE} CAD
        </Button>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          Shipping calculated at checkout · Ships from Canada worldwide
        </p>
      </div>
    </div>
  );
};

const MerchSection = () => {
  return (
    <section id="store" className="py-20 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs uppercase tracking-wider mb-4">
            <Sparkles className="h-3 w-3" />
            Limited Pre-order
          </span>
          <h2
            className="text-4xl md:text-5xl lg:text-6xl font-light tracking-wider mb-4 text-gradient-gold uppercase"
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
            Menlifoot <span>Jerseys</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Wear the colors. Carry the culture. Pre-order at{" "}
            <span className="text-primary font-semibold">$75 CAD</span> until{" "}
            {PREORDER_DEADLINE} — retail price{" "}
            <span className="line-through">$95 CAD</span>.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto">
          {products.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <JerseyCard product={p} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MerchSection;

