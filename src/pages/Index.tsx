import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ArticlesSection from "@/components/ArticlesSection";
import ChatSection from "@/components/ChatSection";
import MerchSection from "@/components/MerchSection";
import CartDrawer from "@/components/CartDrawer";
import AIAgent from "@/components/AIAgent";
import Footer from "@/components/Footer";
import { CartProvider } from "@/contexts/CartContext";

const Index = () => {
  return (
    <CartProvider>
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Navbar />
        <main>
          <HeroSection />
          <ChatSection />
          {/* <MerchSection /> — temporarily hidden */}
          <ArticlesSection />
        </main>
        <Footer />
        <AIAgent />
        <CartDrawer />
      </div>
    </CartProvider>
  );
};

export default Index;
