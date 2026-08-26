import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, Share2, Calendar, User, Clock, Tag, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { RichTextContent } from "@/components/RichTextContent";
import { getCategoryLabel } from "@/lib/articleCategories";

interface Article {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  content: string;
  category: string;
  thumbnail_url: string | null;
  author: string | null;
  published_at: string | null;
  view_count: number | null;
  keywords: string[] | null;
  original_language?: string;
}

// Common words to filter out from keywords (stopwords)
const STOPWORDS = new Set([
  // French
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux', 'et', 'ou', 'mais', 'donc', 'car', 
  'que', 'qui', 'quoi', 'dont', 'où', 'ce', 'cette', 'ces', 'son', 'sa', 'ses', 'leur', 'leurs',
  'nous', 'vous', 'ils', 'elles', 'on', 'je', 'tu', 'il', 'elle', 'pour', 'dans', 'avec', 'sur',
  'par', 'en', 'est', 'sont', 'a', 'ont', 'été', 'être', 'avoir', 'fait', 'faire', 'plus', 'très',
  'aussi', 'bien', 'tout', 'tous', 'toute', 'toutes', 'même', 'autre', 'autres', 'quel', 'quelle',
  'match', 'matchs', 'comme', 'avant', 'après', 'entre', 'sous', 'contre', 'sans', 'chez',
  // English
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its',
  'our', 'their', 'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how',
  'game', 'games', 'match', 'matches', 'about', 'after', 'before', 'between', 'during',
  // Spanish
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero', 'porque', 'como',
  'que', 'quien', 'cual', 'cuando', 'donde', 'por', 'para', 'con', 'sin', 'sobre', 'entre',
  'es', 'son', 'está', 'están', 'fue', 'fueron', 'ser', 'estar', 'tener', 'hacer',
  'partido', 'partidos',
  // Haitian Creole
  'ak', 'nan', 'pou', 'ki', 'se', 'te', 'yo', 'li', 'nou', 'ou', 'mwen', 'sa', 'la', 'a',
  // Common partial words to exclude
  'cius', 'bernab', 'jr', 'fc', 'cf'
]);

// Known multi-word phrases that should be combined (lowercase for matching)
const KNOWN_PHRASES: Record<string, string> = {
  'real+madrid': 'Real Madrid',
  'madrid+real': 'Real Madrid',
  'thiago+silva': 'Thiago Silva',
  'silva+thiago': 'Thiago Silva',
  'world+cup': 'World Cup',
  'cup+world': 'World Cup',
  'coupe+monde': 'Coupe du Monde',
  'monde+coupe': 'Coupe du Monde',
  'champions+league': 'Champions League',
  'league+champions': 'Champions League',
  'ligue+champions': 'Ligue des Champions',
  'manchester+united': 'Manchester United',
  'united+manchester': 'Manchester United',
  'manchester+city': 'Manchester City',
  'city+manchester': 'Manchester City',
  'paris+saint': 'Paris Saint-Germain',
  'saint+germain': 'Saint-Germain',
  'psg+paris': 'PSG',
  'fc+barcelona': 'FC Barcelona',
  'barcelona+fc': 'FC Barcelona',
  'bayern+munich': 'Bayern Munich',
  'munich+bayern': 'Bayern Munich',
  'juventus+turin': 'Juventus Turin',
  'atletico+madrid': 'Atlético Madrid',
  'madrid+atletico': 'Atlético Madrid',
  'inter+milan': 'Inter Milan',
  'milan+inter': 'Inter Milan',
  'ac+milan': 'AC Milan',
  'milan+ac': 'AC Milan',
  'borussia+dortmund': 'Borussia Dortmund',
  'dortmund+borussia': 'Borussia Dortmund',
  'tottenham+hotspur': 'Tottenham Hotspur',
  'arsenal+london': 'Arsenal',
  'chelsea+london': 'Chelsea',
  'liverpool+fc': 'Liverpool FC',
  'ballon+or': "Ballon d'Or",
  'or+ballon': "Ballon d'Or",
  'kylian+mbappe': 'Kylian Mbappé',
  'mbappe+kylian': 'Kylian Mbappé',
  'cristiano+ronaldo': 'Cristiano Ronaldo',
  'ronaldo+cristiano': 'Cristiano Ronaldo',
  'lionel+messi': 'Lionel Messi',
  'messi+lionel': 'Lionel Messi',
  'erling+haaland': 'Erling Haaland',
  'haaland+erling': 'Erling Haaland',
  'vinicius+junior': 'Vinícius Jr.',
  'junior+vinicius': 'Vinícius Jr.',
  'neymar+jr': 'Neymar Jr.',
  'jr+neymar': 'Neymar Jr.',
  'xabi+alonso': 'Xabi Alonso',
  'alonso+xabi': 'Xabi Alonso',
  'carlo+ancelotti': 'Carlo Ancelotti',
  'ancelotti+carlo': 'Carlo Ancelotti',
  'pep+guardiola': 'Pep Guardiola',
  'guardiola+pep': 'Pep Guardiola',
  'europa+league': 'Europa League',
  'league+europa': 'Europa League',
  'premier+league': 'Premier League',
  'league+premier': 'Premier League',
  'la+liga': 'La Liga',
  'liga+la': 'La Liga',
  'serie+a': 'Serie A',
  'bundesliga+germany': 'Bundesliga',
  'ligue+1': 'Ligue 1',
};

// Filter and improve keywords - combine known phrases
const filterKeywords = (keywords: string[] | null): string[] => {
  if (!keywords || keywords.length === 0) return [];
  
  const lowerKeywords = keywords.map(k => k.toLowerCase().trim());
  const usedIndices = new Set<number>();
  const result: string[] = [];
  
  // First pass: find and combine known phrases
  for (let i = 0; i < lowerKeywords.length; i++) {
    if (usedIndices.has(i)) continue;
    
    for (let j = i + 1; j < lowerKeywords.length; j++) {
      if (usedIndices.has(j)) continue;
      
      const combo = `${lowerKeywords[i]}+${lowerKeywords[j]}`;
      if (KNOWN_PHRASES[combo]) {
        result.push(KNOWN_PHRASES[combo]);
        usedIndices.add(i);
        usedIndices.add(j);
        break;
      }
    }
  }
  
  // Second pass: add remaining valid keywords
  for (let i = 0; i < keywords.length; i++) {
    if (usedIndices.has(i)) continue;
    
    const kw = keywords[i];
    const lower = kw.toLowerCase().trim();
    
    // Exclude stopwords, very short words, and partial words
    if (lower.length > 2 && 
        !STOPWORDS.has(lower) && 
        !/\d/.test(kw) &&
        !/^[a-z]$/.test(lower)) {
      // Capitalize first letter for display
      result.push(kw.charAt(0).toUpperCase() + kw.slice(1));
    }
  }
  
  return result.slice(0, 8); // Limit to 8 keywords max
};

// Helper to update meta tags dynamically
const updateMetaTags = (article: Article) => {
  const description = article.summary || article.content.substring(0, 100).replace(/\s+/g, ' ').trim() + "...";
  const imageUrl = article.thumbnail_url || "https://menlifoot.ca/og-image.png";
  const pageUrl = window.location.href;

  // Update document title
  document.title = `${article.title} | Menlifoot`;

  // Update or create meta tags
  const updateMeta = (property: string, content: string, isProperty = true) => {
    const attr = isProperty ? 'property' : 'name';
    let meta = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attr, property);
      document.head.appendChild(meta);
    }
    meta.content = content;
  };

  // Open Graph
  updateMeta('og:title', article.title);
  updateMeta('og:description', description);
  updateMeta('og:image', imageUrl);
  updateMeta('og:url', pageUrl);
  updateMeta('og:type', 'article');

  // Twitter
  updateMeta('twitter:title', article.title, false);
  updateMeta('twitter:description', description, false);
  updateMeta('twitter:image', imageUrl, false);

  // Standard meta
  updateMeta('description', description, false);
};

const ArticleDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [article, setArticle] = useState<Article | null>(null);
  const [translatedArticle, setTranslatedArticle] = useState<Article | null>(null);
  const [similarArticles, setSimilarArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);

  const [likesCount, setLikesCount] = useState(0);
  const [userLiked, setUserLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  // Fetch translation from database when language changes
  useEffect(() => {
    const fetchTranslation = async () => {
      if (!article) return;

      const originalLang = article.original_language || 'en';

      // If same language, use original
      if (language === originalLang) {
        setTranslatedArticle(article);
        return;
      }

      // Check sessionStorage cache first
      const cacheKey = `article_${article.id}_${language}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setTranslatedArticle(JSON.parse(cached));
        return;
      }

      setTranslating(true);
      try {
        // Fetch from database
        const { data: translation, error } = await supabase
          .from('article_translations')
          .select('*')
          .eq('article_id', article.id)
          .eq('language', language)
          .maybeSingle();

        if (error) {
          console.error('Error fetching translation:', error);
          setTranslatedArticle(article);
          return;
        }

        if (translation) {
          const translated = {
            ...article,
            title: translation.title || article.title,
            subtitle: translation.subtitle || article.subtitle,
            summary: translation.summary || article.summary,
            content: translation.content || article.content,
            keywords: translation.keywords || article.keywords
          };
          sessionStorage.setItem(cacheKey, JSON.stringify(translated));
          setTranslatedArticle(translated);
        } else {
          // No translation in DB, use original
          console.log(`No translation found for ${language}, using original`);
          setTranslatedArticle(article);
        }
      } catch (err) {
        console.error('Translation fetch error:', err);
        setTranslatedArticle(article);
      } finally {
        setTranslating(false);
      }
    };

    fetchTranslation();
  }, [article, language]);

  useEffect(() => {
    if (id) fetchArticle(id);
  }, [id]);

  useEffect(() => {
    if (article) fetchLikes(article.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.id, user?.id]);

  const fetchLikes = async (articleId: string) => {
    const { count } = await supabase
      .from('article_likes')
      .select('*', { count: 'exact', head: true })
      .eq('article_id', articleId);

    setLikesCount(count ?? 0);

    if (!user) {
      setUserLiked(false);
      return;
    }

    const { data: likedRow } = await supabase
      .from('article_likes')
      .select('id')
      .eq('article_id', articleId)
      .eq('user_id', user.id)
      .maybeSingle();

    setUserLiked(!!likedRow);
  };

  const fetchArticle = async (articleId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .eq("is_published", true)
      .maybeSingle();

    if (error) {
      console.error("Error fetching article:", error);
    } else if (data) {
      setArticle(data);
      setTranslatedArticle(data); // Set initial
      updateMetaTags(data);
      fetchSimilarArticles(data.category, articleId);
      incrementViewCount(articleId);
    }
    setLoading(false);
  };

  const fetchSimilarArticles = async (category: string, currentId: string) => {
    const { data } = await supabase
      .from("articles")
      .select("*")
      .eq("category", category)
      .eq("is_published", true)
      .neq("id", currentId)
      .order("published_at", { ascending: false })
      .limit(4);

    if (data) {
      setSimilarArticles(data);
    }
  };

  const incrementViewCount = async (articleId: string) => {
    // Use the database function to increment view count (bypasses RLS)
    const { error } = await supabase.rpc('increment_article_view', { article_id: articleId });

    if (error) {
      console.error('Error incrementing view count:', error);
      return;
    }

    setArticle((prev) => {
      if (!prev || prev.id !== articleId) return prev;
      return { ...prev, view_count: (prev.view_count || 0) + 1 };
    });
  };

  const handleLike = async () => {
    if (!article) return;

    if (!user) {
      toast({
        title: t('articles.loginToLike') || "Login required",
        description: t('articles.loginToLikeDesc') || "Please login to like articles",
        variant: "destructive",
      });
      return;
    }

    if (likeBusy) return;
    setLikeBusy(true);

    try {
      if (userLiked) {
        const { error } = await supabase
          .from('article_likes')
          .delete()
          .eq('article_id', article.id)
          .eq('user_id', user.id);

        if (!error) {
          setUserLiked(false);
          setLikesCount((c) => Math.max(0, c - 1));
        }
      } else {
        const { error } = await supabase
          .from('article_likes')
          .insert({ article_id: article.id, user_id: user.id });

        if (!error) {
          setUserLiked(true);
          setLikesCount((c) => c + 1);
        }
      }
    } finally {
      setLikeBusy(false);
    }
  };

  // Get display article (translated or original)
  const displayArticle = translatedArticle || article;

  const handleShare = () => {
    if (!article) return;

    // Use /share/ prefix for social media crawlers to get proper OG tags
    const shareUrl = `${window.location.origin}/share/articles/${article.id}`;

    // Use reliable textarea-based copy method
    const textArea = document.createElement('textarea');
    textArea.value = shareUrl;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      toast({
        title: t('articles.linkCopied') || "Link copied!",
        description: t('articles.shareSuccess') || "Article link copied to clipboard",
      });
    } catch (err) {
      console.error('Copy failed:', err);
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const estimateReadTime = (content: string) => {
    const words = content.split(/\s+/).length;
    const minutes = Math.ceil(words / 200);
    return `${minutes} min read`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-28 pb-20">
          <div className="container mx-auto px-4 max-w-4xl">
            <Skeleton className="h-8 w-32 mb-6" />
            <Skeleton className="h-12 w-3/4 mb-4" />
            <Skeleton className="h-6 w-1/2 mb-8" />
            <Skeleton className="h-96 w-full rounded-2xl mb-8" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-28 pb-20 text-center">
          <h1 className="text-2xl font-bold mb-4">{t('articles.notFound') || 'Article not found'}</h1>
          <Link to="/articles">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('articles.backToArticles') || 'Back to Articles'}
            </Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Article Header */}
      <section className="pt-28 pb-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <Link to="/articles">
            <Button variant="ghost" className="mb-6 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('articles.backToArticles') || 'Back to Articles'}
            </Button>
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Badge variant="secondary" className="mb-4 bg-primary/90 text-primary-foreground">
              {getCategoryLabel(t, article.category)}
            </Badge>

            {translating && (
              <div className="mb-4 text-sm text-muted-foreground flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                {t('articles.translating') || 'Translating...'}
              </div>
            )}

            <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
              {displayArticle?.title || article.title}
            </h1>

            {(displayArticle?.subtitle || article.subtitle) && (
              <p className="text-xl text-muted-foreground mb-6">{displayArticle?.subtitle || article.subtitle}</p>
            )}

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-8 pb-8 border-b border-border/50">
              {article.author && (
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {article.author}
                </span>
              )}
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {formatDate(article.published_at)}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {estimateReadTime(displayArticle?.content || article.content)}
              </span>
              <span className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                {article.view_count || 0} {t('articles.views') || 'views'}
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Image */}
      {article.thumbnail_url && (
        <section className="pb-8">
          <div className="container mx-auto px-4 max-w-5xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl overflow-hidden"
            >
              <img
                src={article.thumbnail_url}
                alt={displayArticle?.title || article.title}
                className="w-full h-auto max-h-[600px] object-cover"
              />
            </motion.div>
          </div>
        </section>
      )}

      {/* Article Content */}
      <section className="pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <RichTextContent 
              html={displayArticle?.content || article.content} 
              className="prose prose-lg prose-invert max-w-none prose-p:text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary"
            />
          </motion.div>

          {/* Keywords - filtered for quality */}
          {(() => {
            const filteredKeywords = filterKeywords(displayArticle?.keywords || article.keywords);
            return filteredKeywords.length > 0 ? (
              <div className="mt-8 pt-8 border-t border-border/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  {filteredKeywords.map((keyword) => (
                    <Badge key={keyword} variant="outline" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {/* Action Buttons */}
          <div className="flex items-center gap-4 mt-8 pt-8 border-t border-border/50">
            {/* View count display */}
            <div className="flex items-center gap-2 text-muted-foreground px-4 py-2 border border-border rounded-md">
              <Eye className="h-4 w-4" />
              <span>{article.view_count || 0} {t('articles.views') || 'views'}</span>
            </div>

            <Button
              variant="outline"
              onClick={handleLike}
              disabled={likeBusy}
              className={userLiked ? 'text-destructive' : undefined}
            >
              <Heart className={`h-4 w-4 mr-2 ${userLiked ? 'fill-current' : ''}`} />
              {likesCount}
            </Button>

            <Button variant="outline" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              {t('articles.share') || 'Share'}
            </Button>
          </div>
        </div>
      </section>

      {/* Similar Articles */}
      {similarArticles.length > 0 && (
        <section className="py-12 bg-surface-elevated/50">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-2xl font-bold text-foreground mb-8">
              {t('articles.similarArticles') || 'Similar Articles'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {similarArticles.map((similar) => (
                <Link to={`/articles/${similar.id}`} key={similar.id}>
                  <motion.article
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="group rounded-xl overflow-hidden bg-background hover:shadow-lg transition-all"
                  >
                    <div
                      className="h-40 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                      style={{
                        backgroundImage: similar.thumbnail_url
                          ? `url(${similar.thumbnail_url})`
                          : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.5))',
                      }}
                    />
                    <div className="p-4">
                      <Badge variant="outline" className="mb-2 text-xs">
                        {getCategoryLabel(t, similar.category)}
                      </Badge>
                      <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                        {similar.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDate(similar.published_at)}
                      </p>
                    </div>
                  </motion.article>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
};

export default ArticleDetail;
