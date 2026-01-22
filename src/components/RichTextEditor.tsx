import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Youtube from '@tiptap/extension-youtube';
import FontFamily from '@tiptap/extension-font-family';
import CharacterCount from '@tiptap/extension-character-count';
import Link from '@tiptap/extension-link';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough, 
  Quote, 
  List, 
  ListOrdered, 
  Undo, 
  Redo, 
  Heading1,
  Heading2, 
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Code,
  Link as LinkIcon,
  Unlink,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Minus,
  RemoveFormatting,
  ImagePlus,
  Table as TableIcon,
  Palette,
  Highlighter,
  Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon,
  CheckSquare,
  Youtube as YoutubeIcon,
  Type,
  IndentIncrease,
  IndentDecrease,
  RowsIcon,
  ColumnsIcon,
  Trash2,
  Plus,
  Search,
  Replace
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
}

const TEXT_COLORS = [
  { name: 'Default', color: '' },
  { name: 'White', color: '#ffffff' },
  { name: 'Gray', color: '#9ca3af' },
  { name: 'Red', color: '#ef4444' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Yellow', color: '#eab308' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Pink', color: '#ec4899' },
];

const HIGHLIGHT_COLORS = [
  { name: 'None', color: '' },
  { name: 'Yellow', color: '#fef08a' },
  { name: 'Green', color: '#bbf7d0' },
  { name: 'Blue', color: '#bfdbfe' },
  { name: 'Purple', color: '#e9d5ff' },
  { name: 'Pink', color: '#fbcfe8' },
  { name: 'Red', color: '#fecaca' },
  { name: 'Orange', color: '#fed7aa' },
];

const FONT_FAMILIES = [
  { name: 'Default', value: '' },
  { name: 'Inter', value: 'Inter' },
  { name: 'Playfair Display', value: 'Playfair Display' },
  { name: 'Arial', value: 'Arial' },
  { name: 'Georgia', value: 'Georgia' },
  { name: 'Times New Roman', value: 'Times New Roman' },
  { name: 'Courier New', value: 'Courier New' },
  { name: 'Verdana', value: 'Verdana' },
];

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [imagePopoverOpen, setImagePopoverOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubePopoverOpen, setYoutubePopoverOpen] = useState(false);
  const [tablePopoverOpen, setTablePopoverOpen] = useState(false);
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  const [highlightPopoverOpen, setHighlightPopoverOpen] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setLink = useCallback(() => {
    if (!editor) return;
    
    if (linkUrl.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setLinkPopoverOpen(false);
      return;
    }

    const url = linkUrl.match(/^https?:\/\//) ? linkUrl : `https://${linkUrl}`;
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;
    
    if (hasSelection) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      const text = linkText.trim() || url;
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text,
          marks: [
            {
              type: 'link',
              attrs: { href: url, target: '_blank', rel: 'noopener noreferrer' },
            },
          ],
        })
        .run();
    }
    
    setLinkUrl('');
    setLinkText('');
    setLinkPopoverOpen(false);
  }, [editor, linkUrl, linkText]);

  const compressImage = useCallback(async (file: File, maxSizeMB = 2): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        let { width, height } = img;
        const maxDimension = 1920;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        let quality = 0.9;
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error('Compression failed'));
              
              if (blob.size > maxSizeMB * 1024 * 1024 && quality > 0.1) {
                quality -= 0.1;
                tryCompress();
              } else {
                const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
                resolve(compressedFile);
              }
            },
            'image/jpeg',
            quality
          );
        };
        tryCompress();
      };
      
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return;
    
    setIsUploading(true);
    try {
      // Compress image if larger than 2MB
      const processedFile = file.size > 2 * 1024 * 1024 
        ? await compressImage(file, 2)
        : file;
      
      const fileExt = 'jpg';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `article-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('articles')
        .upload(filePath, processedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('articles')
        .getPublicUrl(filePath);

      editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image. Try a smaller file.');
    } finally {
      setIsUploading(false);
      setImagePopoverOpen(false);
    }
  }, [editor, compressImage]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  }, [handleImageUpload]);

  const insertImageByUrl = useCallback(() => {
    if (!editor || !imageUrl.trim()) return;
    const url = imageUrl.match(/^https?:\/\//) ? imageUrl : `https://${imageUrl}`;
    editor.chain().focus().setImage({ src: url }).run();
    setImageUrl('');
    setImagePopoverOpen(false);
  }, [editor, imageUrl]);

  const insertYoutube = useCallback(() => {
    if (!editor || !youtubeUrl.trim()) return;
    editor.commands.setYoutubeVideo({ src: youtubeUrl });
    setYoutubeUrl('');
    setYoutubePopoverOpen(false);
  }, [editor, youtubeUrl]);

  const insertTable = useCallback((rows: number, cols: number) => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setTablePopoverOpen(false);
  }, [editor]);

  const handleFindReplace = useCallback(() => {
    if (!editor || !findText) return;
    
    const content = editor.getHTML();
    if (content.includes(findText)) {
      const newContent = content.replace(new RegExp(findText, 'g'), replaceText);
      editor.commands.setContent(newContent);
      toast.success(`Replaced all occurrences`);
    } else {
      toast.info('Text not found');
    }
  }, [editor, findText, replaceText]);

  if (!editor) return null;

  return (
    <div className="flex flex-wrap gap-0.5 p-2 border-b border-border bg-muted/30 rounded-t-lg max-h-[200px] overflow-y-auto">
      {/* Row 1: Basic formatting */}
      <div className="flex flex-wrap gap-0.5 w-full items-center">
        {/* Font Family */}
        <Select
          value={editor.getAttributes('textStyle').fontFamily || ''}
          onValueChange={(value) => {
            if (value) {
              editor.chain().focus().setFontFamily(value).run();
            } else {
              editor.chain().focus().unsetFontFamily().run();
            }
          }}
        >
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <Type className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Font" />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((font) => (
              <SelectItem key={font.name} value={font.value || 'default'} style={{ fontFamily: font.value }}>
                {font.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Text formatting */}
        <Toggle size="sm" pressed={editor.isActive('bold')} onPressedChange={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('italic')} onPressedChange={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('underline')} onPressedChange={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)">
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('strike')} onPressedChange={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <Strikethrough className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('superscript')} onPressedChange={() => editor.chain().focus().toggleSuperscript().run()} title="Superscript">
          <SuperscriptIcon className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('subscript')} onPressedChange={() => editor.chain().focus().toggleSubscript().run()} title="Subscript">
          <SubscriptIcon className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('code')} onPressedChange={() => editor.chain().focus().toggleCode().run()} title="Inline Code">
          <Code className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Text Color */}
        <Popover open={colorPopoverOpen} onOpenChange={setColorPopoverOpen}>
          <PopoverTrigger asChild>
            <Toggle size="sm" pressed={false} title="Text Color">
              <Palette className="h-4 w-4" />
            </Toggle>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-5 gap-1">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.name}
                  className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: c.color || 'transparent' }}
                  title={c.name}
                  onClick={() => {
                    if (c.color) {
                      editor.chain().focus().setColor(c.color).run();
                    } else {
                      editor.chain().focus().unsetColor().run();
                    }
                    setColorPopoverOpen(false);
                  }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Highlight */}
        <Popover open={highlightPopoverOpen} onOpenChange={setHighlightPopoverOpen}>
          <PopoverTrigger asChild>
            <Toggle size="sm" pressed={editor.isActive('highlight')} title="Highlight">
              <Highlighter className="h-4 w-4" />
            </Toggle>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-4 gap-1">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.name}
                  className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: c.color || 'transparent' }}
                  title={c.name}
                  onClick={() => {
                    if (c.color) {
                      editor.chain().focus().toggleHighlight({ color: c.color }).run();
                    } else {
                      editor.chain().focus().unsetHighlight().run();
                    }
                    setHighlightPopoverOpen(false);
                  }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Headings */}
        <Toggle size="sm" pressed={editor.isActive('heading', { level: 1 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
          <Heading1 className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('heading', { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
          <Heading2 className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('heading', { level: 3 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
          <Heading3 className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('heading', { level: 4 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} title="Heading 4">
          <Heading4 className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('heading', { level: 5 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 5 }).run()} title="Heading 5">
          <Heading5 className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('heading', { level: 6 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 6 }).run()} title="Heading 6">
          <Heading6 className="h-4 w-4" />
        </Toggle>
      </div>

      {/* Row 2: Alignment, Lists, Blocks */}
      <div className="flex flex-wrap gap-0.5 w-full items-center mt-1">
        {/* Alignment */}
        <Toggle size="sm" pressed={editor.isActive({ textAlign: 'left' })} onPressedChange={() => editor.chain().focus().setTextAlign('left').run()} title="Align Left">
          <AlignLeft className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive({ textAlign: 'center' })} onPressedChange={() => editor.chain().focus().setTextAlign('center').run()} title="Align Center">
          <AlignCenter className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive({ textAlign: 'right' })} onPressedChange={() => editor.chain().focus().setTextAlign('right').run()} title="Align Right">
          <AlignRight className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive({ textAlign: 'justify' })} onPressedChange={() => editor.chain().focus().setTextAlign('justify').run()} title="Justify">
          <AlignJustify className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Indent */}
        <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().sinkListItem('listItem').run()} disabled={!editor.can().sinkListItem('listItem')} title="Indent">
          <IndentIncrease className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().liftListItem('listItem').run()} disabled={!editor.can().liftListItem('listItem')} title="Outdent">
          <IndentDecrease className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Lists */}
        <Toggle size="sm" pressed={editor.isActive('bulletList')} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('orderedList')} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List">
          <ListOrdered className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('taskList')} onPressedChange={() => editor.chain().focus().toggleTaskList().run()} title="Task List">
          <CheckSquare className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Blocks */}
        <Toggle size="sm" pressed={editor.isActive('blockquote')} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
          <Quote className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
          <Minus className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Table */}
        <Popover open={tablePopoverOpen} onOpenChange={setTablePopoverOpen}>
          <PopoverTrigger asChild>
            <Toggle size="sm" pressed={false} title="Insert Table">
              <TableIcon className="h-4 w-4" />
            </Toggle>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="space-y-2">
              <p className="text-sm font-medium">Insert Table</p>
              <div className="grid grid-cols-3 gap-2">
                {[[2, 2], [3, 3], [4, 4], [2, 3], [3, 4], [4, 5]].map(([rows, cols]) => (
                  <Button key={`${rows}x${cols}`} size="sm" variant="outline" onClick={() => insertTable(rows, cols)}>
                    {rows}×{cols}
                  </Button>
                ))}
              </div>
              {editor.isActive('table') && (
                <div className="pt-2 border-t space-y-1">
                  <p className="text-xs text-muted-foreground">Table Actions</p>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row">
                      <RowsIcon className="h-3 w-3 mr-1" /><Plus className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column">
                      <ColumnsIcon className="h-3 w-3 mr-1" /><Plus className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row">
                      <RowsIcon className="h-3 w-3 mr-1" /><Trash2 className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column">
                      <ColumnsIcon className="h-3 w-3 mr-1" /><Trash2 className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Row 3: Insert, Productivity */}
      <div className="flex flex-wrap gap-0.5 w-full items-center mt-1">
        {/* Link */}
        <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <Toggle size="sm" pressed={editor.isActive('link')} title="Add Link">
              <LinkIcon className="h-4 w-4" />
            </Toggle>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <div className="space-y-2">
              <label className="text-sm font-medium">Enter URL</label>
              <p className="text-xs text-muted-foreground">For embeds (YouTube / X), paste the URL on its own line.</p>
              <div className="flex gap-2">
                <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" className="text-foreground" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), setLink())} />
                <Button size="sm" onClick={setLink}>Add</Button>
              </div>
              <div>
                <label className="text-sm font-medium">Display text (optional)</label>
                <Input value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="Leave empty to show URL" className="mt-1 text-foreground" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), setLink())} />
              </div>
            </div>
          </PopoverContent>
        </Popover>
        {editor.isActive('link') && (
          <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().unsetLink().run()} title="Remove Link">
            <Unlink className="h-4 w-4" />
          </Toggle>
        )}

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Image */}
        <Popover open={imagePopoverOpen} onOpenChange={setImagePopoverOpen}>
          <PopoverTrigger asChild>
            <Toggle size="sm" pressed={false} title="Add Image">
              <ImagePlus className="h-4 w-4" />
            </Toggle>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Upload Image</label>
                <p className="text-xs text-muted-foreground mb-2">Upload from your device</p>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                <Button size="sm" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? 'Uploading...' : 'Choose File'}
                </Button>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-popover px-2 text-muted-foreground">Or</span></div>
              </div>
              <div>
                <label className="text-sm font-medium">Image URL</label>
                <div className="flex gap-2 mt-1">
                  <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" className="text-foreground" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), insertImageByUrl())} />
                  <Button size="sm" onClick={insertImageByUrl}>Add</Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* YouTube */}
        <Popover open={youtubePopoverOpen} onOpenChange={setYoutubePopoverOpen}>
          <PopoverTrigger asChild>
            <Toggle size="sm" pressed={false} title="Embed YouTube Video">
              <YoutubeIcon className="h-4 w-4" />
            </Toggle>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <div className="space-y-2">
              <label className="text-sm font-medium">YouTube URL</label>
              <p className="text-xs text-muted-foreground">Paste a YouTube video URL to embed</p>
              <div className="flex gap-2">
                <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="text-foreground" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), insertYoutube())} />
                <Button size="sm" onClick={insertYoutube}>Embed</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Find & Replace */}
        <Popover open={findReplaceOpen} onOpenChange={setFindReplaceOpen}>
          <PopoverTrigger asChild>
            <Toggle size="sm" pressed={false} title="Find & Replace">
              <Search className="h-4 w-4" />
            </Toggle>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <div className="space-y-2">
              <label className="text-sm font-medium">Find & Replace</label>
              <Input value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="Find text..." className="text-foreground" />
              <Input value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="Replace with..." className="text-foreground" />
              <Button size="sm" className="w-full" onClick={handleFindReplace}>
                <Replace className="h-4 w-4 mr-2" /> Replace All
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Clear formatting */}
        <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear Formatting">
          <RemoveFormatting className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Undo/Redo */}
        <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
          <Undo className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)">
          <Redo className="h-4 w-4" />
        </Toggle>
      </div>
    </div>
  );
};

export const RichTextEditor = ({ content, onChange, placeholder = 'Write your content...', className, maxLength }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        link: false, // Disable StarterKit's link, use separate Link extension
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'text-primary underline hover:text-primary/80',
        },
      }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: 'max-w-full h-auto rounded-lg my-4' },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Superscript,
      Subscript,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({
        controls: true,
        nocookie: true,
        HTMLAttributes: { class: 'w-full aspect-video rounded-lg my-4' },
      }),
      FontFamily,
      CharacterCount.configure({ limit: maxLength }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none h-[300px] overflow-y-auto p-4 focus:outline-none dark:prose-invert prose-headings:font-semibold prose-headings:text-foreground/90 prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground [&_.ProseMirror-selectednode]:outline-primary [&_.ProseMirror-selectednode]:outline-2 [&_.ProseMirror-selectednode]:outline [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted/50',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const characterCount = editor?.storage.characterCount?.characters() ?? 0;
  const wordCount = editor?.storage.characterCount?.words() ?? 0;

  return (
    <div className={cn('border border-input rounded-lg overflow-hidden bg-background flex flex-col', className)}>
      <MenuBar editor={editor} />
      <div className="flex-1 overflow-hidden">
        <EditorContent editor={editor} className="h-full [&>.tiptap]:h-full" />
      </div>
      <div className="flex justify-between items-center px-3 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
        <span>{wordCount} words</span>
        <span>
          {characterCount} characters
          {maxLength && ` / ${maxLength}`}
        </span>
      </div>
    </div>
  );
};

export default RichTextEditor;
