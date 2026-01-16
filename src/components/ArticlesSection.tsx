import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Newspaper, Calendar, Share2, Heart, Tag, Loader2, Filter, User, TrendingUp, Clock, X, ChevronDown, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Article {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  content: string;
  category: string;
  keywords: string[];
  thumbnail_url: string | null;
  published_at: string | null;
  original_language: string;
  created_at: string;
  author: string | null;
  view_count: number;
}

interface TranslatedArticle extends Article {
  translated?: boolean;
}

// Cache for translated articles
const translationCache: Map<string, TranslatedArticle> = new Map();

// Available categories including Haiti World Cup 26
const CATEGORIES = [
  'All',
  'Haiti World Cup 26',
  'Transfers',
  'Champions League',
  'Ligue 1',
  'Premier League',
  'La Liga',
  'Serie A',
  'World Cup',
  'Analysis'
];

type SortOption = 'latest' | 'oldest' | 'popular';

interface ArticleLike {
  article_id: string;
  count: number;
}

const LIKES_STORAGE_KEY = 'menlifoot_article_likes';

const ArticlesSection = () => {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<Article[]>([]);
  const [translatedArticles, setTranslatedArticles] = useState<TranslatedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [likes, setLikes] = useState<Map<string, ArticleLike>>(new Map());
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const translationInProgress = useRef(false);
  
  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [authorFilter, setAuthorFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('latest');
  const [showFilters, setShowFilters] = useState(false);

  // Map language codes to locales for date formatting
  const localeMap: Record<string, string> = {
    en: 'en-US',
    fr: 'fr-FR',
    es: 'es-ES',
    ht: 'ht-HT'
  };

  const getCacheKey = (articleId: string, targetLang: string) => `${articleId}_${targetLang}`;

  const fetchTranslation = useCallback(async (article: Article, targetLanguage: string): Promise<TranslatedArticle> => {
    // If article is already in target language, return as-is
    if (article.original_language === targetLanguage) {
      return { ...article, translated: false };
    }

    // Check cache first
    const cacheKey = getCacheKey(article.id, targetLanguage);
    const cached = translationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Fetch from database instead of calling edge function
      const { data: translation, error } = await supabase
        .from('article_translations')
        .select('*')
        .eq('article_id', article.id)
        .eq('language', targetLanguage)
        .maybeSingle();

      if (error) {
        console.error('Error fetching translation:', error);
        return { ...article, translated: false };
      }

      if (translation) {
        const translated: TranslatedArticle = {
          ...article,
          title: translation.title || article.title,
          subtitle: translation.subtitle || article.subtitle,
          summary: translation.summary || article.summary,
          content: translation.content || article.content,
          keywords: translation.keywords || article.keywords,
          translated: true
        };

        // Cache the result
        translationCache.set(cacheKey, translated);
        return translated;
      }

      // No translation found, return original
      return { ...article, translated: false };
    } catch (error) {
      console.error('Translation fetch error:', error);
      return { ...article, translated: false };
    }
  }, []);

  const translateAllArticles = useCallback(async (articlesToTranslate: Article[], targetLanguage: string) => {
    if (translationInProgress.current) return;
    translationInProgress.current = true;
    
    // Check if any article needs translation
    const needsTranslation = articlesToTranslate.some(
      article => article.original_language !== targetLanguage && 
                 !translationCache.has(getCacheKey(article.id, targetLanguage))
    );

    if (needsTranslation) {
      setTranslating(true);
    }

    try {
      const translated = await Promise.all(
        articlesToTranslate.map(article => fetchTranslation(article, targetLanguage))
      );
      setTranslatedArticles(translated);
    } catch (error) {
      console.error('Translation batch error:', error);
      setTranslatedArticles(articlesToTranslate.map(a => ({ ...a, translated: false })));
    } finally {
      setTranslating(false);
      translationInProgress.current = false;
    }
  }, [fetchTranslation]);

  // Get liked articles from localStorage
  const getStoredLikes = useCallback((): string[] => {
    try {
      const stored = localStorage.getItem(LIKES_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  const setStoredLikes = useCallback((likedIds: string[]) => {
    localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(likedIds));
  }, []);

  const fetchLikes = useCallback(async () => {
    const { data: likesData } = await supabase
      .from("article_likes")
      .select("article_id");

    if (likesData) {
      const likesMap = new Map<string, ArticleLike>();
      
      likesData.forEach((like) => {
        const existing = likesMap.get(like.article_id);
        if (existing) {
          existing.count++;
        } else {
          likesMap.set(like.article_id, { article_id: like.article_id, count: 1 });
        }
      });

      setLikes(likesMap);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
    fetchLikes();

    // Subscribe to realtime updates for articles (view counts)
    const articlesChannel = supabase
      .channel('articles-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'articles'
        },
        (payload) => {
          const updated = payload.new as Article;
          setArticles(prev => prev.map(a => a.id === updated.id ? { ...a, view_count: updated.view_count || 0 } : a));
        }
      )
      .subscribe();

    // Subscribe to realtime updates for likes
    const likesChannel = supabase
      .channel('article-likes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'article_likes'
        },
        () => {
          // Refetch likes on any change
          fetchLikes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(articlesChannel);
      supabase.removeChannel(likesChannel);
    };
  }, [fetchLikes]);

  // Translate articles when language changes
  useEffect(() => {
    if (articles.length > 0) {
      translateAllArticles(articles, language);
    }
  }, [language, articles, translateAllArticles]);

  const fetchArticles = async () => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false });

      if (error) throw error;
      const fetchedArticles = (data || []).map(article => ({
        ...article,
        original_language: article.original_language || 'en',
        author: article.author || null,
        view_count: article.view_count || 0
      }));
      setArticles(fetchedArticles);
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique authors from articles
  const uniqueAuthors = useMemo(() => {
    const authors = articles
      .map(a => a.author)
      .filter((author): author is string => !!author);
    return ['All', ...Array.from(new Set(authors))];
  }, [articles]);

  // Filter and sort articles
  const filteredAndSortedArticles = useMemo(() => {
    let result = translatedArticles.length > 0 
      ? translatedArticles 
      : articles.map(a => ({ ...a, translated: false }));

    // Apply category filter
    if (categoryFilter !== 'All') {
      result = result.filter(a => a.category.toLowerCase() === categoryFilter.toLowerCase());
    }

    // Apply author filter
    if (authorFilter !== 'All') {
      result = result.filter(a => a.author === authorFilter);
    }

    // Apply sorting
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime();
        case 'oldest':
          return new Date(a.published_at || a.created_at).getTime() - new Date(b.published_at || b.created_at).getTime();
        case 'popular':
          return (b.view_count || 0) - (a.view_count || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [articles, translatedArticles, categoryFilter, authorFilter, sortBy]);

  const activeFiltersCount = (categoryFilter !== 'All' ? 1 : 0) + (authorFilter !== 'All' ? 1 : 0);

  const clearFilters = () => {
    setCategoryFilter('All');
    setAuthorFilter('All');
    setSortBy('latest');
  };

  const handleLike = (articleId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const storedLikes = getStoredLikes();
    const isLiked = storedLikes.includes(articleId);

    if (isLiked) {
      // Unlike - remove from localStorage
      const newStoredLikes = storedLikes.filter(id => id !== articleId);
      setStoredLikes(newStoredLikes);

      setLikes((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(articleId);
        if (existing) {
          existing.count = Math.max(0, existing.count - 1);
        }
        return newMap;
      });
    } else {
      // Like - add to localStorage
      const newStoredLikes = [...storedLikes, articleId];
      setStoredLikes(newStoredLikes);

      setLikes((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(articleId);
        if (existing) {
          existing.count++;
        } else {
          newMap.set(articleId, { article_id: articleId, count: 1 });
        }
        return newMap;
      });
    }
  };

  const isArticleLiked = (articleId: string): boolean => {
    return getStoredLikes().includes(articleId);
  };

  const handleShare = (article: TranslatedArticle, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Use /share/ prefix for social media crawlers to get proper OG tags
    const shareUrl = `${window.location.origin}/share/articles/${article.id}`;

    // Always copy to clipboard first using the most reliable method
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
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(localeMap[language] || 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <section className="py-20 md:py-32 relative overflow-hidden">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </section>
    );
  }

  if (articles.length === 0) {
    return null;
  }

  return (
    <section id="articles" className="py-20 md:py-32 relative overflow-hidden bg-background">
      {/* Solid black background - gradient removed */}
      
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs uppercase tracking-wider mb-4">
            <Newspaper className="h-3 w-3" />
            {t('articles.badge')}
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-wider mb-4 text-gradient-gold uppercase" style={{ fontFamily: "'Oswald', sans-serif" }}>
            {t('articles.title')} <span>{t('articles.titleHighlight')}</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t('articles.description')}
          </p>
          {translating && (
            <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t('articles.translating')}</span>
            </div>
          )}
        </motion.div>

        {/* Filters Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            {/* Filter Toggle & Active Filters */}
            <div className="flex items-center gap-3">
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                {t('articles.filters')}
                {activeFiltersCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-foreground text-primary rounded-full">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>

              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground hover:text-foreground gap-1"
                >
                  <X className="h-3 w-3" />
                  {t('articles.clearAll')}
                </Button>
              )}
            </div>

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  {sortBy === 'latest' && <Clock className="h-4 w-4" />}
                  {sortBy === 'oldest' && <Calendar className="h-4 w-4" />}
                  {sortBy === 'popular' && <TrendingUp className="h-4 w-4" />}
                  {sortBy === 'latest' ? t('articles.latest') : sortBy === 'oldest' ? t('articles.oldest') : t('articles.popular')}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border border-border z-50">
                <DropdownMenuItem onClick={() => setSortBy('latest')} className="gap-2 cursor-pointer">
                  <Clock className="h-4 w-4" />
                  {t('articles.latestFirst')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('oldest')} className="gap-2 cursor-pointer">
                  <Calendar className="h-4 w-4" />
                  {t('articles.oldestFirst')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('popular')} className="gap-2 cursor-pointer">
                  <TrendingUp className="h-4 w-4" />
                  {t('articles.mostPopular')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-card p-4 space-y-4"
            >
              {/* Category Filter */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">{t('articles.category')}</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((category) => (
                    <button
                      key={category}
                      onClick={() => setCategoryFilter(category)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                        categoryFilter === category
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-surface text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {category === 'All' ? t('articles.all') : category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Author Filter */}
              {uniqueAuthors.length > 1 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">{t('articles.author')}</label>
                  <div className="flex flex-wrap gap-2">
                    {uniqueAuthors.map((author) => (
                      <button
                        key={author}
                        onClick={() => setAuthorFilter(author)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1 ${
                          authorFilter === author
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-surface text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        <User className="h-3 w-3" />
                        {author === 'All' ? t('articles.all') : author}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Results count */}
          <div className="text-sm text-muted-foreground mt-4">
            {t('articles.showingOf').replace('{count}', String(filteredAndSortedArticles.length)).replace('{total}', String(articles.length))}
          </div>
        </motion.div>

        {/* Articles Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedArticles.map((article, index) => (
            <Link to={`/articles/${article.id}`} key={article.id}>
              <motion.article
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 * index }}
                className="glass-card overflow-hidden hover-lift group cursor-pointer h-full"
              >
                {/* Thumbnail */}
                {article.thumbnail_url && (
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={article.thumbnail_url}
                      alt={article.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                )}
                
                <div className="p-5">
                  {/* Category, Author & Date */}
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-primary font-medium uppercase tracking-wider px-2 py-1 bg-primary/10 rounded">
                        {article.category}
                      </span>
                      {article.author && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {article.author}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(article.published_at)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-display text-xl font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {article.title}
                  </h3>

                  {/* Subtitle */}
                  {article.subtitle && (
                    <p className="text-muted-foreground text-sm font-medium mb-2 line-clamp-1">
                      {article.subtitle}
                    </p>
                  )}

                  {/* Summary */}
                  {article.summary && (
                    <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                      {article.summary}
                    </p>
                  )}

                  {/* Keywords */}
                  {article.keywords && article.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {article.keywords.slice(0, 3).map((keyword, i) => (
                        <span key={i} className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded flex items-center gap-1">
                          <Tag className="h-2.5 w-2.5" />
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions - Views, Likes, Share */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {article.view_count || 0}
                      </span>
                      <button
                        onClick={(e) => handleLike(article.id, e)}
                        className={`flex items-center gap-1 transition-colors ${
                          isArticleLiked(article.id)
                            ? 'text-red-500'
                            : 'hover:text-red-500'
                        }`}
                      >
                        <Heart className={`h-3.5 w-3.5 ${isArticleLiked(article.id) ? 'fill-current' : ''}`} />
                        {likes.get(article.id)?.count || 0}
                      </button>
                    </div>
                    <button
                      onClick={(e) => handleShare(article, e)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      {t('articles.share')}
                    </button>
                  </div>
                </div>
              </motion.article>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ArticlesSection;
