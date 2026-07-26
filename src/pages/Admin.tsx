import { useState, useEffect, useRef } from 'react';
import QuizAdmin from '@/components/QuizAdmin';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Trash2, Edit2, LogOut, ArrowLeft, Youtube, Music2, FileText, Calendar, Image, Users, Shield, ShieldOff, Ban, UserCheck, Languages, RefreshCw, X, Tag, Eye, Trophy, Package } from 'lucide-react';
import { OrdersAdmin } from '@/components/OrdersAdmin';
import { ArticlePreviewDialog } from '@/components/ArticlePreviewDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/RichTextEditor';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Podcast {
  id: string;
  title: string;
  description: string | null;
  platform: string;
  original_url: string;
  embed_url: string;
  episode_number: number | null;
  duration: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  created_at: string;
}

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
  is_published: boolean;
  is_editorial: boolean;
  original_language: string;
  created_at: string;
}

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role: 'admin' | 'editor' | 'user' | null;
  banned_until: string | null;
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'ht', name: 'Haitian Creole' },
];

const convertToEmbedUrl = (url: string, platform: string): string => {
  if (platform === 'spotify') {
    // Convert Spotify URLs to embed format
    // https://open.spotify.com/episode/xxx -> https://open.spotify.com/embed/episode/xxx
    const match = url.match(/spotify\.com\/(episode|show|track)\/([a-zA-Z0-9]+)/);
    if (match) {
      return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
    }
  } else if (platform === 'youtube') {
    // Convert YouTube URLs to embed format
    let videoId = '';
    if (url.includes('youtube.com/watch')) {
      const urlParams = new URL(url).searchParams;
      videoId = urlParams.get('v') || '';
    } else if (url.includes('youtube.com/shorts/')) {
      videoId = url.split('youtube.com/shorts/')[1]?.split('?')[0]?.split('/')[0] || '';
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
    }
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  }
  return url;
};

const detectPlatform = (url: string): 'spotify' | 'youtube' | null => {
  if (url.includes('spotify.com')) return 'spotify';
  if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('youtube.com/shorts')) return 'youtube';
  return null;
};

const ARTICLE_CATEGORIES = [
  'Match Analysis',
  'Transfer News',
  'Player Spotlight',
  'World Cup 2026',
  'Champions League',
  'Premier League',
  'La Liga',
  'Serie A',
  'Bundesliga',
  'MLS',
  'Tactics',
  'Opinion',
  'Did You Know?',
  'Flashback',
  'Football Business',
  'Haiti',
];

// Common keyword suggestions for football articles
const KEYWORD_SUGGESTIONS = [
  'football', 'soccer', 'world cup', 'champions league', 'premier league', 'la liga',
  'serie a', 'bundesliga', 'ligue 1', 'transfer', 'goal', 'match', 'player',
  'team', 'coach', 'tactics', 'analysis', 'hat-trick', 'penalty', 'red card',
  'yellow card', 'VAR', 'offside', 'assist', 'clean sheet', 'derby', 'rivalry',
  'injury', 'comeback', 'upset', 'Real Madrid', 'Barcelona', 'Manchester United',
  'Liverpool', 'Chelsea', 'Arsenal', 'Bayern Munich', 'PSG', 'Juventus',
  'Inter Milan', 'AC Milan', 'Borussia Dortmund', 'Atletico Madrid',
  'Haiti', 'World Cup 2026', 'Messi', 'Ronaldo', 'Mbappe', 'Haaland', 'Bellingham',
  'Vinicius Jr', 'Kane', 'Salah', 'De Bruyne', 'Neymar'
];

const generateKeywords = (title: string, content: string, category: string): string[] => {
  const text = `${title} ${content} ${category}`.toLowerCase();
  const commonWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'can', 'this', 'that', 'these', 'those', 'it', 'its'];
  
  const words = text.match(/\b[a-z]{4,}\b/g) || [];
  const wordCount: Record<string, number> = {};
  
  words.forEach(word => {
    if (!commonWords.includes(word)) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  });
  
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
};

const Admin = () => {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articleTranslations, setArticleTranslations] = useState<Record<string, string[]>>({});
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isPodcastDialogOpen, setIsPodcastDialogOpen] = useState(false);
  const [isArticleDialogOpen, setIsArticleDialogOpen] = useState(false);
  const [editingPodcast, setEditingPodcast] = useState<Podcast | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ display_name: string | null } | null>(null);
  const [podcastFormData, setPodcastFormData] = useState({
    title: '',
    description: '',
    original_url: '',
    platform: 'spotify' as 'spotify' | 'youtube',
    episode_number: '',
    duration: '',
  });
  const [articleFormData, setArticleFormData] = useState({
    title: '',
    subtitle: '',
    summary: '',
    content: '',
    category: 'Match Analysis',
    keywords: [] as string[],
    thumbnail_url: '',
    published_at: null as Date | null,
    is_published: false,
    is_editorial: false,
    original_language: 'en',
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [retranslatingId, setRetranslatingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [showKeywordSuggestions, setShowKeywordSuggestions] = useState(false);
  const keywordInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, isAdmin, isEditor, loading, adminLoading, signOut } = useAuth();
  const navigate = useNavigate();

  // Check if user can access admin panel (admin or editor)
  const canAccessPanel = isAdmin || isEditor;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && !adminLoading && user && !canAccessPanel) {
      toast({
        title: 'Access Denied',
        description: 'You do not have admin or editor privileges.',
        variant: 'destructive',
      });
      navigate('/');
    }
  }, [user, canAccessPanel, loading, adminLoading, navigate, toast]);

  useEffect(() => {
    if (canAccessPanel) {
      fetchPodcasts();
      fetchArticles();
      fetchCurrentUserProfile();
      if (isAdmin) {
        fetchUsers();
      }
    }
  }, [canAccessPanel, isAdmin]);

  const fetchCurrentUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setCurrentUserProfile(data);
    }
  };

  const fetchPodcasts = async () => {
    const { data, error } = await supabase
      .from('podcasts')
      .select('*')
      .order('episode_number', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'Failed to load podcasts.', variant: 'destructive' });
    } else {
      setPodcasts(data || []);
    }
  };

  const fetchArticles = async () => {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'Failed to load articles.', variant: 'destructive' });
    } else {
      setArticles(data || []);
      // Fetch translation status for all articles
      if (data && data.length > 0) {
        fetchTranslationStatus(data.map(a => a.id));
      }
    }
  };

  const fetchTranslationStatus = async (articleIds: string[]) => {
    const { data, error } = await supabase
      .from('article_translations')
      .select('article_id, language')
      .in('article_id', articleIds);

    if (!error && data) {
      const statusMap: Record<string, string[]> = {};
      data.forEach(t => {
        if (!statusMap[t.article_id]) {
          statusMap[t.article_id] = [];
        }
        statusMap[t.article_id].push(t.language);
      });
      setArticleTranslations(statusMap);
    }
  };

  const handleRetranslate = async (article: Article) => {
    setRetranslatingId(article.id);
    try {
      await triggerTranslations(
        article.id,
        article.title,
        article.subtitle,
        article.summary,
        article.content,
        article.keywords || [],
        article.original_language
      );
      // Refresh translation status after a short delay
      setTimeout(() => fetchTranslationStatus([article.id]), 3000);
    } finally {
      setRetranslatingId(null);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      // Fetch users via edge function (since we can't access auth.users directly)
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'list' }
      });

      if (error) throw error;
      setUsers(data?.users || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({ title: 'Error', description: 'Failed to load users.', variant: 'destructive' });
    } finally {
      setUsersLoading(false);
    }
  };

  const handleSetRole = async (userId: string, role: 'admin' | 'editor' | null) => {
    try {
      const { error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'setRole', userId, role }
      });

      if (error) throw error;
      toast({ title: 'Success', description: role ? `User set as ${role}.` : 'Role removed.' });
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update role.', variant: 'destructive' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    try {
      const { error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete', userId }
      });

      if (error) throw error;
      toast({ title: 'Success', description: 'User deleted.' });
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete user.', variant: 'destructive' });
    }
  };

  const handleBanUser = async (userId: string, ban: boolean) => {
    try {
      const { error } = await supabase.functions.invoke('manage-users', {
        body: { action: ban ? 'ban' : 'unban', userId }
      });

      if (error) throw error;
      toast({ title: 'Success', description: ban ? 'User banned.' : 'User unbanned.' });
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update user.', variant: 'destructive' });
    }
  };

  const handlePodcastUrlChange = (url: string) => {
    setPodcastFormData(prev => ({ ...prev, original_url: url }));
    const detected = detectPlatform(url);
    if (detected) {
      setPodcastFormData(prev => ({ ...prev, platform: detected }));
    }
  };

  const handlePodcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const embed_url = convertToEmbedUrl(podcastFormData.original_url, podcastFormData.platform);

    const podcastData = {
      title: podcastFormData.title,
      description: podcastFormData.description || null,
      platform: podcastFormData.platform,
      original_url: podcastFormData.original_url,
      embed_url,
      episode_number: podcastFormData.episode_number ? parseInt(podcastFormData.episode_number) : null,
      duration: podcastFormData.duration || null,
      created_by: user?.id,
    };

    try {
      if (editingPodcast) {
        const { error } = await supabase.from('podcasts').update(podcastData).eq('id', editingPodcast.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Podcast updated!' });
      } else {
        const { error } = await supabase.from('podcasts').insert([podcastData]);
        if (error) throw error;
        toast({ title: 'Success', description: 'Podcast added!' });
      }

      setIsPodcastDialogOpen(false);
      setEditingPodcast(null);
      resetPodcastForm();
      fetchPodcasts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save podcast.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const triggerTranslations = async (articleId: string, title: string, subtitle: string | null, summary: string | null, content: string, keywords: string[], originalLanguage: string) => {
    try {
      toast({ title: 'Translating...', description: 'Auto-translating article to all languages. This may take a minute.' });
      
      const { data, error } = await supabase.functions.invoke('translate-all-languages', {
        body: {
          articleId,
          title,
          subtitle,
          summary,
          content,
          keywords,
          originalLanguage
        }
      });

      if (error) {
        console.error('Translation trigger error:', error);
        toast({ title: 'Translation Warning', description: 'Article saved but some translations may have failed.', variant: 'destructive' });
      } else if (data?.success) {
        toast({ title: 'Translations Complete', description: 'Article has been translated to all languages.' });
      } else if (data?.errors?.length > 0) {
        toast({ title: 'Partial Translation', description: `Some translations failed: ${data.errors.join(', ')}`, variant: 'destructive' });
      }
    } catch (err) {
      console.error('Translation error:', err);
    }
  };

  const handleArticleSubmit = async () => {
    setIsLoading(true);

    // Use custom keywords if provided, otherwise auto-generate
    const keywords = articleFormData.keywords.length > 0 
      ? articleFormData.keywords 
      : generateKeywords(articleFormData.title, articleFormData.content, articleFormData.category);

    // Get author name from profile or fallback to email
    const authorName = currentUserProfile?.display_name || user?.email?.split('@')[0] || 'Unknown';

    const articleData = {
      title: articleFormData.title,
      subtitle: articleFormData.subtitle || null,
      summary: articleFormData.summary || null,
      content: articleFormData.content,
      category: articleFormData.category,
      keywords,
      thumbnail_url: articleFormData.thumbnail_url || null,
      published_at: articleFormData.published_at?.toISOString() || (articleFormData.is_published ? new Date().toISOString() : null),
      is_published: articleFormData.is_published,
      is_editorial: articleFormData.is_editorial,
      original_language: articleFormData.original_language,
      created_by: user?.id,
      author: authorName,
    };

    try {
      let savedArticleId: string | undefined;
      
      if (editingArticle) {
        const { error } = await supabase.from('articles').update(articleData).eq('id', editingArticle.id);
        if (error) throw error;
        savedArticleId = editingArticle.id;
        toast({ title: 'Success', description: 'Article updated!' });
      } else {
        const { data: insertedData, error } = await supabase.from('articles').insert([articleData]).select('id').single();
        if (error) throw error;
        savedArticleId = insertedData?.id;
        toast({ title: 'Success', description: 'Article added!' });
      }

      // Trigger translations if article is published
      if (articleFormData.is_published && savedArticleId) {
        // Fire and forget - don't block the UI
        triggerTranslations(
          savedArticleId,
          articleFormData.title,
          articleFormData.subtitle || null,
          articleFormData.summary || null,
          articleFormData.content,
          keywords,
          articleFormData.original_language
        );
      }

      setIsPreviewOpen(false);
      setIsArticleDialogOpen(false);
      setEditingArticle(null);
      resetArticleForm();
      fetchArticles();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save article.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditPodcast = (podcast: Podcast) => {
    setEditingPodcast(podcast);
    setPodcastFormData({
      title: podcast.title,
      description: podcast.description || '',
      original_url: podcast.original_url,
      platform: podcast.platform as 'spotify' | 'youtube',
      episode_number: podcast.episode_number?.toString() || '',
      duration: podcast.duration || '',
    });
    setIsPodcastDialogOpen(true);
  };

  const handleEditArticle = (article: Article) => {
    setEditingArticle(article);
    setArticleFormData({
      title: article.title,
      subtitle: article.subtitle || '',
      summary: article.summary || '',
      content: article.content,
      category: article.category,
      keywords: article.keywords || [],
      thumbnail_url: article.thumbnail_url || '',
      published_at: article.published_at ? new Date(article.published_at) : null,
      is_published: article.is_published,
      is_editorial: article.is_editorial || false,
      original_language: article.original_language || 'en',
    });
    setIsArticleDialogOpen(true);
  };

  const handleDeletePodcast = async (id: string) => {
    if (!confirm('Are you sure you want to delete this podcast?')) return;
    const { error } = await supabase.from('podcasts').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete podcast.', variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Podcast removed.' });
      fetchPodcasts();
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    const { error } = await supabase.from('articles').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete article.', variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Article removed.' });
      fetchArticles();
    }
  };

  const resetPodcastForm = () => {
    setPodcastFormData({
      title: '',
      description: '',
      original_url: '',
      platform: 'spotify',
      episode_number: '',
      duration: '',
    });
  };

  const resetArticleForm = () => {
    setArticleFormData({
      title: '',
      subtitle: '',
      summary: '',
      content: '',
      category: 'Match Analysis',
      keywords: [],
      thumbnail_url: '',
      published_at: null,
      is_published: false,
      is_editorial: false,
      original_language: 'en',
    });
    setKeywordInput('');
  };

  const handleAddKeyword = (keyword: string) => {
    const trimmedKeyword = keyword.trim().toLowerCase();
    if (trimmedKeyword && !articleFormData.keywords.includes(trimmedKeyword)) {
      setArticleFormData(prev => ({
        ...prev,
        keywords: [...prev.keywords, trimmedKeyword]
      }));
    }
    setKeywordInput('');
    setShowKeywordSuggestions(false);
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    setArticleFormData(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keywordToRemove)
    }));
  };

  const handleKeywordInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (keywordInput.trim()) {
        handleAddKeyword(keywordInput);
      }
    } else if (e.key === 'Escape') {
      setShowKeywordSuggestions(false);
    }
  };

  const filteredSuggestions = KEYWORD_SUGGESTIONS.filter(
    suggestion => 
      suggestion.toLowerCase().includes(keywordInput.toLowerCase()) &&
      !articleFormData.keywords.includes(suggestion.toLowerCase())
  ).slice(0, 8);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image file.', variant: 'destructive' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'Image must be less than 5MB.', variant: 'destructive' });
      return;
    }

    setUploadingImage(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `articles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('article-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('article-images')
        .getPublicUrl(filePath);

      setArticleFormData(prev => ({ ...prev, thumbnail_url: publicUrl }));
      toast({ title: 'Success', description: 'Image uploaded!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to upload image.', variant: 'destructive' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  if (!canAccessPanel) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-dark" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />

      <div className="relative z-10 container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8 gap-2">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="text-muted-foreground hover:text-foreground px-2 sm:px-4"
              >
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              
              <img src="/logo.png" alt="" className="h-8 w-auto sm:h-9" />

              <h1 className="font-display text-xl uppercase tracking-wide text-gradient-gold sm:text-[28px]">
                Admin Panel
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-8 h-8 rounded-full bg-gradient-gold flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-primary-foreground uppercase">
                  {user?.email?.charAt(0) || 'A'}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout} className="flex-shrink-0">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="podcasts" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="podcasts" className="flex items-center gap-2">
                <Music2 className="h-4 w-4" />
                <span className="hidden sm:inline">Podcasts</span>
              </TabsTrigger>
              <TabsTrigger value="articles" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Articles</span>
              </TabsTrigger>
              <TabsTrigger value="quizzes" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">Quizzes</span>
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="orders" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">Orders</span>
                </TabsTrigger>
              )}
              {isAdmin && (
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Users</span>
                </TabsTrigger>
              )}
            </TabsList>

            {/* Podcasts Tab */}
            <TabsContent value="podcasts">
              <Dialog open={isPodcastDialogOpen} onOpenChange={(open) => {
                setIsPodcastDialogOpen(open);
                if (!open) { setEditingPodcast(null); resetPodcastForm(); }
              }}>
                <DialogTrigger asChild>
                  <Button variant="gold" className="mb-6">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Podcast Episode
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingPodcast ? 'Edit Podcast' : 'Add New Podcast'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handlePodcastSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="podcast-title">Episode Title *</Label>
                      <Input
                        id="podcast-title"
                        value={podcastFormData.title}
                        onChange={(e) => setPodcastFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Episode title"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="podcast-url">Podcast URL *</Label>
                      <Input
                        id="podcast-url"
                        value={podcastFormData.original_url}
                        onChange={(e) => handlePodcastUrlChange(e.target.value)}
                        placeholder="Paste Spotify or YouTube link"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Platform</Label>
                      <Select
                        value={podcastFormData.platform}
                        onValueChange={(value: 'spotify' | 'youtube') => 
                          setPodcastFormData(prev => ({ ...prev, platform: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="spotify"><div className="flex items-center gap-2"><Music2 className="h-4 w-4" /> Spotify</div></SelectItem>
                          <SelectItem value="youtube"><div className="flex items-center gap-2"><Youtube className="h-4 w-4" /> YouTube</div></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="episode-number">Episode #</Label>
                        <Input
                          id="episode-number"
                          type="number"
                          value={podcastFormData.episode_number}
                          onChange={(e) => setPodcastFormData(prev => ({ ...prev, episode_number: e.target.value }))}
                          placeholder="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="duration">Duration</Label>
                        <Input
                          id="duration"
                          value={podcastFormData.duration}
                          onChange={(e) => setPodcastFormData(prev => ({ ...prev, duration: e.target.value }))}
                          placeholder="45:30"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="podcast-description">Description</Label>
                      <Textarea
                        id="podcast-description"
                        value={podcastFormData.description}
                        onChange={(e) => setPodcastFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Episode description..."
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsPodcastDialogOpen(false)} className="flex-1">Cancel</Button>
                      <Button type="submit" variant="gold" disabled={isLoading} className="flex-1">
                        {isLoading ? 'Saving...' : editingPodcast ? 'Update' : 'Add Podcast'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              <div className="glass-card p-6">
                <h2 className="text-xl font-display font-semibold mb-4">Podcast Episodes ({podcasts.length})</h2>
                {podcasts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No podcasts yet. Add your first episode!</p>
                ) : (
                  <div className="space-y-3">
                    {podcasts.map((podcast) => (
                      <div key={podcast.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 bg-surface rounded-lg border border-border/50">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-gold flex items-center justify-center flex-shrink-0">
                            {podcast.platform === 'youtube' ? <Youtube className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" /> : <Music2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {podcast.episode_number && <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">EP {podcast.episode_number}</span>}
                              <h3 className="font-medium text-foreground truncate text-sm sm:text-base">{podcast.title}</h3>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground">{podcast.platform} • {podcast.duration || 'No duration'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 justify-end sm:justify-start">
                          <Button variant="ghost" size="icon" onClick={() => handleEditPodcast(podcast)} className="h-8 w-8"><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeletePodcast(podcast.id)} className="text-destructive hover:text-destructive h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Articles Tab */}
            <TabsContent value="articles">
              <Dialog open={isArticleDialogOpen} onOpenChange={(open) => {
                setIsArticleDialogOpen(open);
                if (!open) { setEditingArticle(null); resetArticleForm(); }
              }}>
                <DialogTrigger asChild>
                  <Button variant="gold" className="mb-6">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Article
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingArticle ? 'Edit Article' : 'Add New Article'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleArticleSubmit} className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="article-title">Title *</Label>
                        <Input
                          id="article-title"
                          value={articleFormData.title}
                          onChange={(e) => setArticleFormData(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Article title"
                          required
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="article-subtitle">Subtitle</Label>
                        <Input
                          id="article-subtitle"
                          value={articleFormData.subtitle}
                          onChange={(e) => setArticleFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                          placeholder="Article subtitle"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Category *</Label>
                        <Select
                          value={articleFormData.category}
                          onValueChange={(value) => setArticleFormData(prev => ({ ...prev, category: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {ARTICLE_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Language *</Label>
                        <Select
                          value={articleFormData.original_language}
                          onValueChange={(value) => setArticleFormData(prev => ({ ...prev, original_language: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            {LANGUAGES.map((lang) => (
                              <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Publish Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !articleFormData.published_at && "text-muted-foreground")}>
                              <Calendar className="mr-2 h-4 w-4" />
                              {articleFormData.published_at ? format(articleFormData.published_at, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={articleFormData.published_at || undefined}
                              onSelect={(date) => setArticleFormData(prev => ({ ...prev, published_at: date || null }))}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="article-image">Article Image</Label>
                      <div className="flex gap-2">
                        <Input
                          id="article-image"
                          value={articleFormData.thumbnail_url}
                          onChange={(e) => setArticleFormData(prev => ({ ...prev, thumbnail_url: e.target.value }))}
                          placeholder="Upload or paste image URL"
                          className="flex-1"
                        />
                        <label htmlFor="image-upload">
                          <Button type="button" variant="outline" size="icon" asChild disabled={uploadingImage}>
                            <span>
                              {uploadingImage ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              ) : (
                                <Image className="h-4 w-4" />
                              )}
                            </span>
                          </Button>
                        </label>
                        <input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </div>
                      {articleFormData.thumbnail_url && (
                        <div className="mt-2 relative w-full h-32 rounded-lg overflow-hidden border border-border">
                          <img 
                            src={articleFormData.thumbnail_url} 
                            alt="Article preview" 
                            className="w-full h-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => setArticleFormData(prev => ({ ...prev, thumbnail_url: '' }))}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="article-summary">Summary</Label>
                      <Textarea
                        id="article-summary"
                        value={articleFormData.summary}
                        onChange={(e) => setArticleFormData(prev => ({ ...prev, summary: e.target.value }))}
                        placeholder="Brief summary of the article..."
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="article-content">Content *</Label>
                      <RichTextEditor
                        content={articleFormData.content}
                        onChange={(content) => setArticleFormData(prev => ({ ...prev, content }))}
                        placeholder="Write your article content here..."
                        className="min-h-[250px]"
                      />
                    </div>

                    {/* Keywords/Tags Section */}
                    <div className="space-y-2">
                      <Label htmlFor="article-keywords" className="flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Keywords / Tags
                      </Label>
                      <div className="relative">
                        <Input
                          ref={keywordInputRef}
                          id="article-keywords"
                          value={keywordInput}
                          onChange={(e) => {
                            setKeywordInput(e.target.value);
                            setShowKeywordSuggestions(e.target.value.length > 0);
                          }}
                          onFocus={() => setShowKeywordSuggestions(keywordInput.length > 0 || true)}
                          onBlur={() => setTimeout(() => setShowKeywordSuggestions(false), 200)}
                          onKeyDown={handleKeywordInputKeyDown}
                          placeholder="Type a keyword and press Enter..."
                        />
                        {/* Suggestions dropdown */}
                        {showKeywordSuggestions && filteredSuggestions.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredSuggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                className="w-full px-3 py-2 text-left hover:bg-muted transition-colors text-sm"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleAddKeyword(suggestion);
                                }}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Selected keywords */}
                      {articleFormData.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {articleFormData.keywords.map((keyword) => (
                            <span
                              key={keyword}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary rounded-full text-xs"
                            >
                              {keyword}
                              <button
                                type="button"
                                onClick={() => handleRemoveKeyword(keyword)}
                                className="hover:text-destructive transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {articleFormData.keywords.length > 0 
                          ? `${articleFormData.keywords.length} keyword(s) added` 
                          : 'Add custom keywords or leave empty to auto-generate from content'}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="is-published"
                          checked={articleFormData.is_published}
                          onCheckedChange={(checked) => setArticleFormData(prev => ({ ...prev, is_published: checked }))}
                        />
                        <Label htmlFor="is-published">Publish immediately</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="is-editorial"
                          checked={articleFormData.is_editorial}
                          onCheckedChange={(checked) => setArticleFormData(prev => ({ ...prev, is_editorial: checked }))}
                        />
                        <Label htmlFor="is-editorial" className="flex items-center gap-1">
                          Editorial Article
                          <span className="text-xs text-muted-foreground">(Featured in Editorial section)</span>
                        </Label>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsArticleDialogOpen(false)} className="flex-1">Cancel</Button>
                      <Button 
                        type="button" 
                        variant="gold" 
                        disabled={!articleFormData.title || !articleFormData.content}
                        onClick={() => setIsPreviewOpen(true)}
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview & Save
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Article Preview Dialog */}
              <ArticlePreviewDialog
                open={isPreviewOpen}
                onOpenChange={setIsPreviewOpen}
                article={articleFormData}
                onEdit={() => setIsPreviewOpen(false)}
                onPublish={handleArticleSubmit}
                isLoading={isLoading}
                isEditing={!!editingArticle}
              />

              <div className="glass-card p-6">
                <h2 className="text-xl font-display font-semibold mb-4">Articles ({articles.length})</h2>
                {articles.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No articles yet. Add your first article!</p>
                ) : (
                  <div className="space-y-3">
                    {articles.map((article) => {
                      const translations = articleTranslations[article.id] || [];
                      const targetLangs = LANGUAGES.filter(l => l.code !== article.original_language);
                      const allTranslated = targetLangs.every(l => translations.includes(l.code));
                      
                      return (
                        <div key={article.id} className="flex flex-col sm:flex-row gap-3 p-3 sm:p-4 bg-surface rounded-lg border border-border/50">
                          {/* Thumbnail & Info Row */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {article.thumbnail_url ? (
                              <div className="w-14 h-14 sm:w-16 sm:h-12 rounded-lg overflow-hidden flex-shrink-0">
                                <img src={article.thumbnail_url} alt={article.title} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-14 h-14 sm:w-16 sm:h-12 rounded-lg bg-gradient-gold flex items-center justify-center flex-shrink-0">
                                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              {/* Badges Row */}
                              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded whitespace-nowrap">{article.category}</span>
                                {article.is_published ? (
                                  <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-500 rounded">Published</span>
                                ) : (
                                  <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded">Draft</span>
                                )}
                              </div>
                              
                              {/* Translation Status - Separate Row on Mobile */}
                              {article.is_published && (
                                <div className="flex items-center gap-1 mb-1.5">
                                  <Languages className="h-3 w-3 text-muted-foreground" />
                                  {LANGUAGES.map((lang) => {
                                    const isOriginal = lang.code === article.original_language;
                                    const hasTranslation = translations.includes(lang.code);
                                    return (
                                      <span
                                        key={lang.code}
                                        className={cn(
                                          "text-[10px] px-1.5 py-0.5 rounded font-medium uppercase",
                                          isOriginal ? "bg-blue-500/20 text-blue-400" :
                                          hasTranslation ? "bg-green-500/20 text-green-400" :
                                          "bg-muted text-muted-foreground"
                                        )}
                                        title={isOriginal ? `Original (${lang.name})` : hasTranslation ? `Translated to ${lang.name}` : `Not translated to ${lang.name}`}
                                      >
                                        {lang.code}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                              
                              <h3 className="font-medium text-foreground truncate text-sm sm:text-base">{article.title}</h3>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                {article.published_at ? format(new Date(article.published_at), 'MMM d, yyyy') : 'No date set'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Actions Row */}
                          <div className="flex items-center gap-2 justify-end sm:justify-start border-t sm:border-t-0 pt-2 sm:pt-0 sm:border-l sm:pl-3">
                            {article.is_published && !allTranslated && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleRetranslate(article)}
                                disabled={retranslatingId === article.id}
                                title="Retranslate article"
                                className="h-8 w-8"
                              >
                                <RefreshCw className={cn("h-4 w-4", retranslatingId === article.id && "animate-spin")} />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handleEditArticle(article)} className="h-8 w-8"><Edit2 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteArticle(article.id)} className="text-destructive hover:text-destructive h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Quizzes Tab - forceMount to preserve form state */}
            <TabsContent value="quizzes" forceMount className="data-[state=inactive]:hidden">
              <QuizAdmin userId={user?.id} />
            </TabsContent>

            {/* Orders Tab - Admin Only */}
            {isAdmin && (
              <TabsContent value="orders">
                <div className="glass-card p-6">
                  <OrdersAdmin />
                </div>
              </TabsContent>
            )}

            {/* Users Tab - Admin Only */}
            {isAdmin && (
              <TabsContent value="users">
                <div className="glass-card p-6">
                  <h2 className="text-xl font-display font-semibold mb-4">User Management ({users.length})</h2>
                  {usersLoading ? (
                    <p className="text-muted-foreground text-center py-8">Loading users...</p>
                  ) : users.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No users found.</p>
                  ) : (
                    <div className="space-y-3">
                      {users.map((u) => (
                        <div key={u.id} className="flex flex-col gap-3 p-3 sm:p-4 bg-surface rounded-lg border border-border/50">
                          {/* User Info Row */}
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-gold flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-bold text-primary-foreground uppercase">
                                {u.email?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                {u.role === 'admin' && (
                                  <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded flex items-center gap-1">
                                    <Shield className="h-3 w-3" /> Admin
                                  </span>
                                )}
                                {u.role === 'editor' && (
                                  <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-500 rounded flex items-center gap-1">
                                    <Edit2 className="h-3 w-3" /> Editor
                                  </span>
                                )}
                                {u.banned_until && (
                                  <span className="text-xs px-2 py-0.5 bg-destructive/20 text-destructive rounded flex items-center gap-1">
                                    <Ban className="h-3 w-3" /> Banned
                                  </span>
                                )}
                              </div>
                              <h3 className="font-medium text-foreground truncate text-sm sm:text-base">{u.email}</h3>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                Joined {format(new Date(u.created_at), 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                          
                          {/* Actions Row */}
                          <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                            {u.role !== 'admin' && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleSetRole(u.id, 'admin')}
                                className="text-xs h-8"
                              >
                                <Shield className="h-3 w-3 sm:mr-1" />
                                <span className="hidden sm:inline">Make Admin</span>
                              </Button>
                            )}
                            {u.role !== 'editor' && u.role !== 'admin' && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleSetRole(u.id, 'editor')}
                                className="text-xs h-8"
                              >
                                <Edit2 className="h-3 w-3 sm:mr-1" />
                                <span className="hidden sm:inline">Make Editor</span>
                              </Button>
                            )}
                            {(u.role === 'admin' || u.role === 'editor') && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  if (u.id === user?.id) return;
                                  handleSetRole(u.id, null);
                                }}
                                disabled={u.id === user?.id}
                                title={u.id === user?.id ? "You can't change your own role" : undefined}
                                className="text-xs h-8"
                              >
                                <ShieldOff className="h-3 w-3 sm:mr-1" />
                                <span className="hidden sm:inline">Remove Role</span>
                              </Button>
                            )}
                            {u.banned_until ? (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  if (u.id === user?.id) return;
                                  handleBanUser(u.id, false);
                                }}
                                disabled={u.id === user?.id}
                                title={u.id === user?.id ? "You can't unban your own account" : undefined}
                                className="text-xs text-green-500 h-8"
                              >
                                <UserCheck className="h-3 w-3 sm:mr-1" />
                                <span className="hidden sm:inline">Unban</span>
                              </Button>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  if (u.id === user?.id) return;
                                  handleBanUser(u.id, true);
                                }}
                                disabled={u.id === user?.id}
                                title={u.id === user?.id ? "You can't ban your own account" : undefined}
                                className="text-xs text-yellow-500 h-8"
                              >
                                <Ban className="h-3 w-3 sm:mr-1" />
                                <span className="hidden sm:inline">Ban</span>
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                if (u.id === user?.id) return;
                                handleDeleteUser(u.id);
                              }}
                              disabled={u.id === user?.id}
                              title={u.id === user?.id ? "You can't delete your own account" : undefined}
                              className="text-destructive hover:text-destructive h-8 w-8 ml-auto"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default Admin;
