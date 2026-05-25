import { useState } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ArticlesSection from "@/components/ArticlesSection";
import ChatSection from "@/components/ChatSection";
import MerchSection from "@/components/MerchSection";
import CartDrawer from "@/components/CartDrawer";
import AIAgent from "@/components/AIAgent";
import Footer from "@/components/Footer";
import SplashIntro from "@/components/SplashIntro";
import { CartProvider } from "@/contexts/CartContext";

const Index = () => {
  const hasSeenSplash = sessionStorage.getItem('menlifoot_splash_seen') === 'true';
  const [showContent, setShowContent] = useState(hasSeenSplash);

  return (
    <CartProvider>
      <div className="min-h-screen bg-background overflow-x-hidden">
        {!hasSeenSplash && (
          <SplashIntro onComplete={() => {
            sessionStorage.setItem('menlifoot_splash_seen', 'true');
            setShowContent(true);
          }} />
        )}
        
        {showContent && (
          <>
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
          </>
        )}
      </div>
    </CartProvider>
  );
};

export default Index;
