import { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
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

const PRICE = 75;

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
      variant: `${genderLabel} · ${size}`,
      price: PRICE,
      image: product.front,
    });
    toast.success("Added to cart");
    openCart();
  };

  return (
    <div className="glass-card overflow-hidden hover-lift">
      <div className="relative aspect-square overflow-hidden bg-surface p-4 group">
        <img
          src={view === "front" ? product.front : product.back}
          alt={`${product.name} ${view}`}
          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3 flex gap-1 bg-background/70 backdrop-blur rounded-full p-1">
          {(["front", "back"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-xs uppercase tracking-wider px-3 py-1 rounded-full transition-colors ${
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display uppercase tracking-wide text-foreground text-lg leading-tight">
            {product.name}
          </h3>
          <span className="text-lg font-bold text-primary whitespace-nowrap">
            ${PRICE.toFixed(2)} CAD
          </span>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Fit
          </p>
          <div className="flex gap-2">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                onClick={() => setGender(g.value)}
                className={`flex-1 text-xs uppercase tracking-wider py-2 rounded-md border transition-colors ${
                  gender === g.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground/70 hover:border-primary/50"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Size
          </p>
          <div className="flex gap-2">
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`flex-1 text-sm font-semibold py-2 rounded-md border transition-colors ${
                  size === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground/70 hover:border-primary/50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <Button variant="gold" className="w-full" onClick={handleAdd}>
          <ShoppingBag className="h-4 w-4 mr-2" />
          Add to cart
        </Button>
      </div>
    </div>
  );
};

const MerchSection = () => {
  const { t } = useLanguage();

  return (
    <section id="store" className="py-20 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs uppercase tracking-wider mb-4">
            <ShoppingBag className="h-3 w-3" />
            Official Store
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
            <span className="text-gradient-gold">Menlifoot</span> Jerseys
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Wear the colors. Carry the culture. Available in male, female and kid fits.
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
