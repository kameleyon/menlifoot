import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Eye, Heart, Share2, Calendar, User, ArrowRight, Newspaper, Filter, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CATEGORY_VALUES, getCategoryLabel } from "@/lib/articleCategories";

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
  original_language: string | null;
  is_editorial: boolean;
}

interface ArticleLike {
  article_id: string;
  count: number;
  userLiked: boolean;
}

const Articles = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [translatedArticles, setTranslatedArticles] = useState<Article[]>([]);
  const [translating, setTranslating] = useState(false);
  const translationInProgress = useRef(false);
  const [likes, setLikes] = useState<Map<string, ArticleLike>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [showEditorialOnly, setShowEditorialOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilter = selectedCategory !== null || selectedAuthor !== null || showEditorialOnly;

  const categories: string[] = [...CATEGORY_VALUES];

  // Handle URL query parameters for filtering
  useEffect(() => {
    const authorParam = searchParams.get('author');
    const editorialParam = searchParams.get('editorial');
    
    if (authorParam) {
      setSelectedAuthor(authorParam);
      setShowFilters(true);
    }
    if (editorialParam === 'true') {
      setShowEditorialOnly(true);
      setShowFilters(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchArticles();
    fetchLikes();

    // Subscribe to realtime updates for articles (view counts)
    const articlesChannel = supabase
      .channel('articles-page-realtime')
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
      .channel('article-likes-page-realtime')
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
  }, [user]);

  const fetchArticles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("is_published", true)
      .order("published_at", { ascending: false });

    if (error) {
      console.error("Error fetching articles:", error);
    } else {
      const normalized = (data || []).map((a: any) => ({
        ...a,
        original_language: a.original_language || "en",
      })) as Article[];
      setArticles(normalized);
    }
    setLoading(false);
  };

  const getTranslationCacheKey = useCallback(
    (articleId: string, targetLang: string) => `menlifoot_article_${articleId}_${targetLang}`,
    []
  );

  const fetchTranslation = useCallback(
    async (article: Article, targetLang: string): Promise<Article> => {
      const originalLang = article.original_language || "en";
      if (originalLang === targetLang) return article;

      const cacheKey = getTranslationCacheKey(article.id, targetLang);
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached) as Article;
        } catch {
          // ignore cache parse errors
        }
      }

      const { data: translation, error } = await supabase
        .from("article_translations")
        .select("*")
        .eq("article_id", article.id)
        .eq("language", targetLang)
        .maybeSingle();

      if (error || !translation) return article;

      const merged: Article = {
        ...article,
        title: translation.title || article.title,
        subtitle: translation.subtitle || article.subtitle,
        summary: translation.summary || article.summary,
        content: translation.content || article.content,
        keywords: translation.keywords || article.keywords,
      };

      sessionStorage.setItem(cacheKey, JSON.stringify(merged));
      return merged;
    },
    [getTranslationCacheKey]
  );

  useEffect(() => {
    if (articles.length === 0) return;
    if (translationInProgress.current) return;

    let cancelled = false;

    const run = async () => {
      translationInProgress.current = true;

      const needsTranslation = articles.some((a) => {
        const originalLang = a.original_language || "en";
        if (originalLang === language) return false;
        const cacheKey = getTranslationCacheKey(a.id, language);
        return !sessionStorage.getItem(cacheKey);
      });

      if (needsTranslation) setTranslating(true);

      try {
        const results = await Promise.all(articles.map((a) => fetchTranslation(a, language)));
        if (!cancelled) setTranslatedArticles(results);
      } finally {
        if (!cancelled) setTranslating(false);
        translationInProgress.current = false;
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [articles, language, fetchTranslation, getTranslationCacheKey]);

  const fetchLikes = async () => {
    // Get all likes counts
    const { data: likesData } = await supabase
      .from("article_likes")
      .select("article_id");

    if (likesData) {
      const likesMap = new Map<string, ArticleLike>();

      // Count likes per article
      likesData.forEach((like) => {
        const existing = likesMap.get(like.article_id);
        if (existing) {
          existing.count++;
        } else {
          likesMap.set(like.article_id, { article_id: like.article_id, count: 1, userLiked: false });
        }
      });

      // Check if current user has liked
      if (user) {
        const { data: userLikes } = await supabase
          .from("article_likes")
          .select("article_id")
          .eq("user_id", user.id);

        userLikes?.forEach((like) => {
          const existing = likesMap.get(like.article_id);
          if (existing) {
            existing.userLiked = true;
          }
        });
      }

      setLikes(likesMap);
    }
  };

  const handleLike = async (articleId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast({
        title: t('articles.loginToLike') || "Login required",
        description: t('articles.loginToLikeDesc') || "Please login to like articles",
        variant: "destructive",
      });
      return;
    }

    const currentLike = likes.get(articleId);
    const isLiked = currentLike?.userLiked || false;

    if (isLiked) {
      // Unlike
      await supabase
        .from("article_likes")
        .delete()
        .eq("article_id", articleId)
        .eq("user_id", user.id);

      setLikes((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(articleId);
        if (existing) {
          existing.count = Math.max(0, existing.count - 1);
          existing.userLiked = false;
        }
        return newMap;
      });
    } else {
      // Like
      await supabase
        .from("article_likes")
        .insert({ article_id: articleId, user_id: user.id });

      setLikes((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(articleId);
        if (existing) {
          existing.count++;
          existing.userLiked = true;
        } else {
          newMap.set(articleId, { article_id: articleId, count: 1, userLiked: true });
        }
        return newMap;
      });
    }
  };

  const handleShare = async (article: Article, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const shareUrl = `${window.location.origin}/articles/${article.id}`;
    
    // Use textarea fallback for reliable clipboard copy
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
      console.error('Failed to copy:', err);
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

  const displayArticles = translatedArticles.length > 0 ? translatedArticles : articles;

  const filteredArticles = useMemo(() => {
    return displayArticles.filter((article) => {
      const matchesSearch = searchQuery
        ? article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          article.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          article.content.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      const matchesCategory = selectedCategory ? article.category === selectedCategory : true;
      
      const matchesAuthor = selectedAuthor 
        ? article.author?.toLowerCase() === selectedAuthor.toLowerCase() 
        : true;
      
      const matchesEditorial = showEditorialOnly ? article.is_editorial === true : true;

      return matchesSearch && matchesCategory && matchesAuthor && matchesEditorial;
    });
  }, [displayArticles, searchQuery, selectedCategory, selectedAuthor, showEditorialOnly]);

  const featuredArticle = filteredArticles[0];
  const secondaryArticles = filteredArticles.slice(1, 4);
  const remainingArticles = filteredArticles.slice(4);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Header */}
      <section className="pt-28 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <Newspaper className="h-10 w-10 text-primary" />
              <h1 className="font-display text-4xl md:text-6xl font-bold text-gradient-gold uppercase tracking-tight">
                {t('articles.title') || 'Sports News'}
              </h1>
            </div>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t('articles.subtitle') || 'The latest football news, transfers, and analysis from around the world'}
            </p>
          </motion.div>

          {/* Search Bar + Filter Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-3xl mx-auto mb-8"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t('articles.searchPlaceholder') || "Search articles..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-14 text-lg bg-surface-elevated border-border/50 rounded-xl"
                />
              </div>
              <Button
                variant={showFilters ? "default" : "outline"}
                size="lg"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2 h-14 px-5"
              >
                <Filter className="h-4 w-4" />
                {t('articles.filters')}
                {hasActiveFilter && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-foreground text-primary rounded-full">
                    1
                  </span>
                )}
              </Button>
              {hasActiveFilter && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => {
                    setSelectedCategory(null);
                    setSelectedAuthor(null);
                    setShowEditorialOnly(false);
                    setSearchParams({});
                  }}
                  className="text-muted-foreground hover:text-foreground gap-1 h-14"
                >
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </motion.div>

          {/* Category Filters - Collapsible */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-card p-4 max-w-4xl mx-auto"
            >
              <label className="text-sm font-medium text-muted-foreground mb-3 block">{t('articles.category')}</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                    selectedCategory === null
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {t('articles.all') || 'All'}
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                      selectedCategory === category
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-surface text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {getCategoryLabel(t, category)}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Articles Grid - Newspaper Style */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Skeleton className="h-[500px] lg:col-span-2 rounded-2xl" />
              <div className="space-y-4">
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
              </div>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-20">
              <Newspaper className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">{t('articles.noResults') || 'No articles found'}</h3>
              <p className="text-muted-foreground">{t('articles.tryDifferentSearch') || 'Try a different search term or category'}</p>
            </div>
          ) : (
            <>
              {/* Featured + Secondary Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
                {/* Featured Article */}
                {featuredArticle && (
                  <Link to={`/articles/${featuredArticle.id}`} className="lg:col-span-2">
                    <motion.article
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group relative h-[500px] rounded-2xl overflow-hidden bg-surface-elevated"
                    >
                      <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                        style={{
                          backgroundImage: featuredArticle.thumbnail_url
                            ? `url(${featuredArticle.thumbnail_url})`
                            : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.5))',
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                      
                      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                        <Badge variant="secondary" className="mb-4 bg-primary/90 text-primary-foreground">
                          {getCategoryLabel(t, featuredArticle.category)}
                        </Badge>
                        <h2 className="font-display text-2xl md:text-4xl font-bold text-foreground mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                          {featuredArticle.title}
                        </h2>
                        {featuredArticle.summary && (
                          <p className="text-muted-foreground line-clamp-2 mb-4 max-w-2xl">
                            {featuredArticle.summary}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {featuredArticle.author && (
                              <span className="flex items-center gap-1">
                                <User className="h-4 w-4" />
                                {featuredArticle.author}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(featuredArticle.published_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Eye className="h-4 w-4" />
                              {featuredArticle.view_count || 0}
                            </span>
                            <button
                              onClick={(e) => handleLike(featuredArticle.id, e)}
                              className={`flex items-center gap-1 text-sm transition-colors ${
                                likes.get(featuredArticle.id)?.userLiked
                                  ? 'text-red-500'
                                  : 'text-muted-foreground hover:text-red-500'
                              }`}
                            >
                              <Heart className={`h-4 w-4 ${likes.get(featuredArticle.id)?.userLiked ? 'fill-current' : ''}`} />
                              {likes.get(featuredArticle.id)?.count || 0}
                            </button>
                            <button
                              onClick={(e) => handleShare(featuredArticle, e)}
                              className="text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Share2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.article>
                  </Link>
                )}

                {/* Secondary Articles */}
                <div className="space-y-6">
                  {secondaryArticles.map((article, index) => (
                    <Link to={`/articles/${article.id}`} key={article.id}>
                      <motion.article
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * (index + 1) }}
                        className="group flex gap-4 p-4 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 transition-all"
                      >
                        <div
                          className="w-24 h-24 flex-shrink-0 rounded-lg bg-cover bg-center"
                          style={{
                            backgroundImage: article.thumbnail_url
                              ? `url(${article.thumbnail_url})`
                              : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.5))',
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <Badge variant="outline" className="mb-2 text-xs">
                            {getCategoryLabel(t, article.category)}
                          </Badge>
                          <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors mb-2">
                            {article.title}
                          </h3>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {article.view_count || 0}
                            </span>
                            <button
                              onClick={(e) => handleLike(article.id, e)}
                              className={`flex items-center gap-1 transition-colors ${
                                likes.get(article.id)?.userLiked ? 'text-red-500' : 'hover:text-red-500'
                              }`}
                            >
                              <Heart className={`h-3 w-3 ${likes.get(article.id)?.userLiked ? 'fill-current' : ''}`} />
                              {likes.get(article.id)?.count || 0}
                            </button>
                            <button onClick={(e) => handleShare(article, e)}>
                              <Share2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </motion.article>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Remaining Articles Grid */}
              {remainingArticles.length > 0 && (
                <>
                  <div className="border-t border-border/50 pt-8 mb-8">
                    <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
                      <ArrowRight className="h-6 w-6 text-primary" />
                      {t('articles.moreStories') || 'More Stories'}
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {remainingArticles.map((article, index) => (
                      <Link to={`/articles/${article.id}`} key={article.id}>
                        <motion.article
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 * index }}
                          className="group h-full rounded-xl overflow-hidden bg-surface-elevated hover:shadow-xl transition-all"
                        >
                          <div
                            className="h-48 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                            style={{
                              backgroundImage: article.thumbnail_url
                                ? `url(${article.thumbnail_url})`
                                : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.5))',
                            }}
                          />
                          <div className="p-5">
                            <Badge variant="outline" className="mb-3">
                              {getCategoryLabel(t, article.category)}
                            </Badge>
                            <h3 className="font-semibold text-lg text-foreground line-clamp-2 group-hover:text-primary transition-colors mb-2">
                              {article.title}
                            </h3>
                            {article.summary && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                                {article.summary}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {formatDate(article.published_at)}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <Eye className="h-4 w-4" />
                                  {article.view_count || 0}
                                </span>
                                <button
                                  onClick={(e) => handleLike(article.id, e)}
                                  className={`flex items-center gap-1 transition-colors ${
                                    likes.get(article.id)?.userLiked ? 'text-red-500' : 'hover:text-red-500'
                                  }`}
                                >
                                  <Heart className={`h-4 w-4 ${likes.get(article.id)?.userLiked ? 'fill-current' : ''}`} />
                                  {likes.get(article.id)?.count || 0}
                                </button>
                                <button onClick={(e) => handleShare(article, e)}>
                                  <Share2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.article>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Articles;
