import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RichTextContent } from '@/components/RichTextContent';
import { format } from 'date-fns';
import { Calendar, Tag, Eye, Edit2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCategoryLabel } from '@/lib/articleCategories';

interface ArticlePreviewData {
  title: string;
  subtitle: string;
  summary: string;
  content: string;
  category: string;
  keywords: string[];
  thumbnail_url: string;
  published_at: Date | null;
  is_published: boolean;
  is_editorial: boolean;
  original_language: string;
}

interface ArticlePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article: ArticlePreviewData;
  onEdit: () => void;
  onPublish: () => void;
  isLoading?: boolean;
  isEditing?: boolean;
}

export const ArticlePreviewDialog = ({
  open,
  onOpenChange,
  article,
  onEdit,
  onPublish,
  isLoading = false,
  isEditing = false,
}: ArticlePreviewDialogProps) => {
  const { t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[95vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Article Preview
            </DialogTitle>
            <div className="flex items-center gap-2">
              {article.is_published ? (
                <span className="text-xs px-2 py-1 bg-green-500/20 text-green-500 rounded">
                  Will be Published
                </span>
              ) : (
                <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded">
                  Draft
                </span>
              )}
              {article.is_editorial && (
                <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">
                  Editorial
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(95vh-180px)]">
          <div className="p-6">
            {/* Hero Image */}
            {article.thumbnail_url && (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-6">
                <img
                  src={article.thumbnail_url}
                  alt={article.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
            )}

            {/* Meta Info */}
            <div className="flex flex-wrap gap-3 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium">
                {getCategoryLabel(t, article.category)}
              </span>
              {article.published_at && (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {format(article.published_at, 'PPP')}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl font-display font-bold mb-3 text-foreground">
              {article.title || 'Untitled Article'}
            </h1>

            {/* Subtitle */}
            {article.subtitle && (
              <p className="text-xl text-muted-foreground mb-4">
                {article.subtitle}
              </p>
            )}

            {/* Summary */}
            {article.summary && (
              <div className="p-4 bg-muted/30 rounded-lg border border-border/50 mb-6">
                <p className="text-foreground/80 italic">{article.summary}</p>
              </div>
            )}

            {/* Content */}
            <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground/80">
              {article.content ? (
                <RichTextContent html={article.content} />
              ) : (
                <p className="text-muted-foreground italic">No content yet...</p>
              )}
            </div>

            {/* Keywords */}
            {article.keywords.length > 0 && (
              <div className="mt-8 pt-6 border-t border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Keywords</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {article.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="px-2 py-1 bg-muted text-muted-foreground rounded-md text-xs"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="p-4 border-t border-border bg-muted/20 flex gap-3">
          <Button
            variant="outline"
            onClick={onEdit}
            className="flex-1"
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Continue Editing
          </Button>
          <Button
            variant="gold"
            onClick={onPublish}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                {isEditing ? 'Update Article' : 'Save Article'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ArticlePreviewDialog;
