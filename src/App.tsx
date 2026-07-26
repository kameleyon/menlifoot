import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./contexts/CartContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider } from "./contexts/AuthContext";
import Index from "./pages/Index";
import Home from "./pages/Home";
import Article from "./pages/Article";
import Editorial from "./pages/Editorial";
import QuizList from "./pages/QuizList";
import Ask from "./pages/Ask";
import Listen from "./pages/Listen";
import Shop from "./pages/Shop";
import Me from "./pages/Me";
import News from "./pages/News";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Podcasts from "./pages/Podcasts";
import Articles from "./pages/Articles";
import ArticleDetail from "./pages/ArticleDetail";
import ShareArticleRedirect from "./pages/ShareArticleRedirect";
import Quizzes from "./pages/Quizzes";
import QuizPlay from "./pages/QuizPlay";
import GrenadiersApp from "./pages/GrenadiersApp";
import NotFound from "./pages/NotFound";
import CheckoutReturn from "./pages/CheckoutReturn";
import Unsubscribe from "./pages/Unsubscribe";
import { PaymentTestModeBanner } from "./components/PaymentTestModeBanner";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <PaymentTestModeBanner />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/old-home" element={<Index />} />
                <Route path="/listen" element={<Listen />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/me" element={<Me />} />
                <Route path="/ask" element={<Ask />} />
                <Route path="/checkout/return" element={<CheckoutReturn />} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                <Route path="/news" element={<News />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/podcasts" element={<Podcasts />} />
                <Route path="/articles" element={<Editorial />} />
                <Route path="/articles/:id" element={<Article />} />
                <Route path="/articles/:id/full" element={<ArticleDetail />} />
                <Route path="/share/articles/:id" element={<ShareArticleRedirect />} />
                <Route path="/quizzes" element={<QuizList />} />
                <Route path="/quizzes/:id" element={<QuizPlay />} />
                <Route path="/grenadiers" element={<GrenadiersApp />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
