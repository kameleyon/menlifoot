import { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import jerseyBlackCombo from "@/assets/jersey-black-combo.jpeg";
import jerseyBlackFront from "@/assets/jersey-black-front.jpeg";
import jerseyBlackBack from "@/assets/jersey-black-back.jpeg";
import jerseyWhiteCombo from "@/assets/jersey-white-combo.jpeg";
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
    image: jerseyBlackFront,
    images: [jerseyBlackCombo, jerseyBlackFront, jerseyBlackBack],
  },
  {
    id: "jersey-white",
    name: "Menlifoot Jersey — White",
    image: jerseyWhiteFront,
    images: [jerseyWhiteCombo, jerseyWhiteFront, jerseyWhiteBack],
  },
];

const JerseyCard = ({ product }: { product: (typeof products)[number] }) => {
  const [paused, setPaused] = useState(false);
  const [gender, setGender] = useState<Gender>("male");
  const [size, setSize] = useState<Size>("M");
  const [customName, setCustomName] = useState("");
  const [customNumber, setCustomNumber] = useState("");
  const { addToCart, openCart } = useCart();

  const handleNameChange = (v: string) => {
    const cleaned = v.toUpperCase().replace(/[^A-Z\s'-]/g, "").slice(0, 12);
    setCustomName(cleaned);
  };
  const handleNumberChange = (v: string) => {
    const cleaned = v.replace(/[^0-9]/g, "").slice(0, 2);
    setCustomNumber(cleaned);
  };

  const handleAdd = () => {
    const name = customName.trim();
    const number = customNumber.trim();
    const lineId = `${product.id}-${gender}-${size}-${name || "noname"}-${number || "nonum"}`;
    const genderLabel = GENDERS.find((g) => g.value === gender)?.label ?? gender;
    const customPart = name || number ? ` · ${name || "—"} #${number || "—"}` : "";
    addToCart({
      id: lineId,
      productId: product.id,
      name: product.name,
      variant: `${genderLabel} · ${size} · Pre-order${customPart}`,
      price: PREORDER_PRICE,
      image: product.image,
    });
    toast.success("Added to cart", { duration: 1500, position: "top-center" });
    openCart();
  };

  return (
    <div className="glass-card overflow-hidden hover-lift border border-border/60">
      <div
        className="relative aspect-square overflow-hidden bg-surface group cursor-pointer select-none"
        onClick={() => setPaused((p) => !p)}
        title={paused ? "Click to resume" : "Click to pause"}
      >
        {/* Wide image: front on left, back on right. Slides left on hover. */}
        <img
          src={product.image}
          alt={product.name}
          draggable={false}
          className={`absolute top-0 left-0 h-full w-[200%] max-w-none object-contain p-6 transition-transform ease-in-out ${
            paused ? "duration-0" : "duration-[3500ms] group-hover:-translate-x-1/2"
          }`}
        />
        <div className="absolute top-4 right-4 inline-flex items-center gap-1 bg-primary text-primary-foreground text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 rounded-full font-semibold shadow-md">
          <Sparkles className="h-3 w-3" />
          Pre-order
        </div>
        {paused && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.15em] bg-background/80 backdrop-blur-md text-foreground/80 px-3 py-1 rounded-full border border-border/40">
            Paused — click to resume
          </div>
        )}
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

        <div className="space-y-3 rounded-lg border border-border/50 bg-background/30 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.15em] text-primary font-semibold">
              Customize the back
            </span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Optional
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">
                Name
              </label>
              <Input
                value={customName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="RICHARD"
                maxLength={12}
                className="bg-background/50 uppercase tracking-wider"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">
                Number
              </label>
              <Input
                value={customNumber}
                onChange={(e) => handleNumberChange(e.target.value)}
                placeholder="10"
                inputMode="numeric"
                maxLength={2}
                className="bg-background/50 text-center"
              />
            </div>
          </div>
          {(customName || customNumber) && (
            <p className="text-[11px] text-muted-foreground">
              Preview: <span className="text-primary font-semibold tracking-wider">{customName || "—"}</span>{" "}
              <span className="text-primary font-semibold">#{customNumber || "—"}</span>
            </p>
          )}
        </div>

        <Button
          size="lg"
          onClick={handleAdd}
          className="w-full font-medium tracking-wide uppercase text-black bg-gradient-to-r from-[hsl(45,90%,55%)] via-[hsl(45,95%,65%)] to-[hsl(45,85%,50%)] hover:from-[hsl(45,90%,60%)] hover:via-[hsl(45,95%,70%)] hover:to-[hsl(45,85%,55%)] shadow-[0_4px_20px_-4px_hsl(45,90%,55%/0.55)] hover:shadow-[0_6px_28px_-4px_hsl(45,90%,55%/0.75)] transition-all duration-300 border border-[hsl(45,80%,45%)]/40"
        >
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

