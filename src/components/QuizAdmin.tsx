import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Upload, X, Image, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  time_limit_seconds: number;
  is_published: boolean;
  created_at: string;
}

interface QuizItem {
  id: string;
  quiz_id: string;
  answer: string;
  acceptable_answers: string[] | null;
  hint: string | null;
  display_value: string | null;
  sort_order: number;
}

interface InlineItem {
  key: string; // local key for React
  display_value: string;
  answer: string;
  acceptable_answers: string;
  hint: string;
}

const createEmptyItem = (): InlineItem => ({
  key: crypto.randomUUID(),
  display_value: "",
  answer: "",
  acceptable_answers: "",
  hint: "",
});

const QuizAdmin = ({ userId }: { userId: string | undefined }) => {
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All-in-one form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [timeLimit, setTimeLimit] = useState(300);
  const [isPublished, setIsPublished] = useState(false);
  const [items, setItems] = useState<InlineItem[]>([createEmptyItem()]);

  // Bulk paste
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkText, setBulkText] = useState("");

  // Expand quiz in list to see existing items
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);
  const [existingItems, setExistingItems] = useState<Record<string, QuizItem[]>>({});

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    const { data, error } = await supabase
      .from("quizzes")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setQuizzes(data || []);
  };

  const fetchQuizItems = async (quizId: string) => {
    const { data, error } = await supabase
      .from("quiz_items")
      .select("*")
      .eq("quiz_id", quizId)
      .order("sort_order");
    if (!error) {
      setExistingItems((prev) => ({ ...prev, [quizId]: data || [] }));
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setThumbnailUrl("");
    setTimeLimit(300);
    setIsPublished(false);
    setItems([createEmptyItem()]);
    setShowBulkPaste(false);
    setBulkText("");
    setEditingQuiz(null);
  };

  const openNewQuiz = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEditQuiz = async (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setTitle(quiz.title);
    setDescription(quiz.description || "");
    setThumbnailUrl(quiz.thumbnail_url || "");
    setTimeLimit(quiz.time_limit_seconds);
    setIsPublished(quiz.is_published);
    setShowBulkPaste(false);
    setBulkText("");

    // Load existing items into inline form
    const { data } = await supabase
      .from("quiz_items")
      .select("*")
      .eq("quiz_id", quiz.id)
      .order("sort_order");

    if (data && data.length > 0) {
      setItems(
        data.map((item) => ({
          key: item.id,
          display_value: item.display_value || "",
          answer: item.answer,
          acceptable_answers: (item.acceptable_answers || []).join(", "),
          hint: item.hint || "",
        }))
      );
    } else {
      setItems([createEmptyItem()]);
    }

    setIsFormOpen(true);
  };

  // Thumbnail upload
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `quiz-thumbnails/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("article-images").upload(path, file);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("article-images").getPublicUrl(path);
    setThumbnailUrl(urlData.publicUrl);
    setUploading(false);
  };

  // Inline item management
  const addItem = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const updateItem = (key: string, field: keyof InlineItem, value: string) => {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, [field]: value } : i))
    );
  };

  // Bulk paste
  const handleBulkPaste = () => {
    const lines = bulkText.split("\n").filter((l) => l.trim());
    const newItems: InlineItem[] = lines.map((line) => {
      const parts = line.includes("\t")
        ? line.split("\t").map((s) => s.trim())
        : line.split(",").map((s) => s.trim());

      return {
        key: crypto.randomUUID(),
        display_value: parts.length >= 2 ? parts[0] : "",
        answer: parts.length >= 2 ? parts[1] : parts[0],
        acceptable_answers: parts.length >= 3 ? parts.slice(2).join(", ") : "",
        hint: "",
      };
    });

    // Replace empty single row or append
    if (items.length === 1 && !items[0].answer) {
      setItems(newItems);
    } else {
      setItems((prev) => [...prev, ...newItems]);
    }
    setBulkText("");
    setShowBulkPaste(false);
    toast({ title: `${newItems.length} items added` });
  };

  // Submit
  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }

    const validItems = items.filter((i) => i.answer.trim());
    if (validItems.length === 0) {
      toast({ title: "Add at least one answer", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const quizData = {
        title: title.trim(),
        description: description.trim() || null,
        thumbnail_url: thumbnailUrl || null,
        time_limit_seconds: timeLimit,
        is_published: isPublished,
        created_by: userId || null,
      };

      let quizId: string;

      if (editingQuiz) {
        const { error } = await supabase.from("quizzes").update(quizData).eq("id", editingQuiz.id);
        if (error) throw error;
        quizId = editingQuiz.id;

        // Delete old items and re-insert
        await supabase.from("quiz_items").delete().eq("quiz_id", quizId);
      } else {
        const { data, error } = await supabase.from("quizzes").insert([quizData]).select("id").single();
        if (error) throw error;
        quizId = data.id;
      }

      // Insert all items
      const itemsData = validItems.map((item, idx) => {
        const acceptableArr = item.acceptable_answers
          .split(",")
          .map((s) => s.trim())
          .flatMap((a) => a.split("|").map((s) => s.trim()))
          .filter(Boolean);

        return {
          quiz_id: quizId,
          answer: item.answer.trim(),
          display_value: item.display_value.trim() || null,
          acceptable_answers: acceptableArr.length > 0 ? acceptableArr : null,
          hint: item.hint.trim() || null,
          sort_order: idx + 1,
        };
      });

      const { error: itemsError } = await supabase.from("quiz_items").insert(itemsData);
      if (itemsError) throw itemsError;

      toast({
        title: "Success",
        description: editingQuiz
          ? `Quiz updated with ${validItems.length} items`
          : `Quiz created with ${validItems.length} items`,
      });

      setIsFormOpen(false);
      resetForm();
      fetchQuizzes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!confirm("Delete this quiz and all its items?")) return;
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete quiz.", variant: "destructive" });
    } else {
      toast({ title: "Deleted" });
      fetchQuizzes();
    }
  };

  const handleTogglePublish = async (quiz: Quiz) => {
    const { error } = await supabase
      .from("quizzes")
      .update({ is_published: !quiz.is_published })
      .eq("id", quiz.id);
    if (!error) fetchQuizzes();
  };

  const handleToggleExpand = (quizId: string) => {
    if (expandedQuizId === quizId) {
      setExpandedQuizId(null);
    } else {
      setExpandedQuizId(quizId);
      if (!existingItems[quizId]) fetchQuizItems(quizId);
    }
  };

  return (
    <div>
      <Button variant="gold" className="mb-6" onClick={openNewQuiz}>
        <Plus className="h-4 w-4 mr-2" />
        Create Quiz
      </Button>

      {/* Full-page quiz editor dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { setIsFormOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingQuiz ? "Edit Quiz" : "Create New Quiz"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Title / Question */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Quiz Question / Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Can you name the 20 players with the most CL knockout appearances?"
                className="text-base"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description or rules..."
                rows={2}
              />
            </div>

            {/* Thumbnail */}
            <div className="space-y-2">
              <Label>Thumbnail Image</Label>
              <div className="flex items-center gap-3">
                {thumbnailUrl ? (
                  <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-border">
                    <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setThumbnailUrl("")}
                      className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-32 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                    disabled={uploading}
                  >
                    <Image className="h-5 w-5" />
                    <span className="text-xs">{uploading ? "Uploading..." : "Upload"}</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleThumbnailUpload}
                />
                <span className="text-xs text-muted-foreground">or paste URL:</span>
                <Input
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1"
                />
              </div>
            </div>

            {/* Timer */}
            <div className="flex items-center gap-4">
              <div className="space-y-2">
                <Label>Timer (minutes)</Label>
                <Input
                  type="number"
                  value={Math.floor(timeLimit / 60)}
                  onChange={(e) => setTimeLimit((parseInt(e.target.value) || 5) * 60)}
                  className="w-24"
                  min={1}
                  max={30}
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                <Label>Publish immediately</Label>
              </div>
            </div>

            {/* Answers Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  Answers ({items.filter((i) => i.answer.trim()).length} items)
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkPaste(!showBulkPaste)}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Bulk Paste
                  </Button>
                  <Button variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Row
                  </Button>
                </div>
              </div>

              {/* Bulk paste area */}
              {showBulkPaste && (
                <div className="bg-muted/30 rounded-lg p-4 space-y-3 border border-border/50">
                  <p className="text-xs text-muted-foreground">
                    Paste one item per line: <code className="bg-muted px-1 py-0.5 rounded text-primary">value, answer, alt1|alt2</code>
                  </p>
                  <pre className="text-xs bg-muted rounded p-2 text-foreground">
{`85, Cristiano Ronaldo, CR7|Ronaldo
77, Lionel Messi, Messi|Leo Messi`}
                  </pre>
                  <Textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={6}
                    placeholder="Paste your data here..."
                    className="font-mono text-sm"
                  />
                  <Button variant="gold" size="sm" onClick={handleBulkPaste} disabled={!bulkText.trim()}>
                    Add to List
                  </Button>
                </div>
              )}

              {/* Header row */}
              <div className="grid grid-cols-[50px_80px_1fr_1fr_1fr_40px] gap-2 text-xs text-muted-foreground font-medium px-1">
                <span>#</span>
                <span>Value</span>
                <span>Answer *</span>
                <span>Alternatives</span>
                <span>Hint</span>
                <span></span>
              </div>

              {/* Item rows */}
              <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div
                    key={item.key}
                    className="grid grid-cols-[50px_80px_1fr_1fr_1fr_40px] gap-2 items-center"
                  >
                    <span className="text-sm text-muted-foreground text-center font-medium">
                      {idx + 1}
                    </span>
                    <Input
                      value={item.display_value}
                      onChange={(e) => updateItem(item.key, "display_value", e.target.value)}
                      placeholder="85"
                      className="h-9 text-sm"
                    />
                    <Input
                      value={item.answer}
                      onChange={(e) => updateItem(item.key, "answer", e.target.value)}
                      placeholder="Cristiano Ronaldo"
                      className="h-9 text-sm"
                    />
                    <Input
                      value={item.acceptable_answers}
                      onChange={(e) => updateItem(item.key, "acceptable_answers", e.target.value)}
                      placeholder="CR7, Ronaldo"
                      className="h-9 text-sm"
                    />
                    <Input
                      value={item.hint}
                      onChange={(e) => updateItem(item.key, "hint", e.target.value)}
                      placeholder="Hint..."
                      className="h-9 text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeItem(item.key)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={addItem} className="w-full border-dashed">
                <Plus className="h-3 w-3 mr-1" /> Add Another Row
              </Button>
            </div>

            {/* Submit */}
            <Button
              variant="gold"
              className="w-full text-base h-12"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading
                ? "Saving..."
                : editingQuiz
                ? `Update Quiz (${items.filter((i) => i.answer.trim()).length} items)`
                : `Create Quiz (${items.filter((i) => i.answer.trim()).length} items)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quiz List */}
      <div className="space-y-3">
        {quizzes.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No quizzes yet. Create your first one!</p>
        )}
        {quizzes.map((quiz) => (
          <div key={quiz.id} className="glass-card rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              {quiz.thumbnail_url && (
                <img src={quiz.thumbnail_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground truncate">{quiz.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${quiz.is_published ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {quiz.is_published ? "Published" : "Draft"}
                  </span>
                </div>
                {quiz.description && (
                  <p className="text-sm text-muted-foreground truncate">{quiz.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  ⏱ {Math.floor(quiz.time_limit_seconds / 60)} min
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={() => handleTogglePublish(quiz)} className="h-8 w-8">
                  <Switch checked={quiz.is_published} className="pointer-events-none" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEditQuiz(quiz)} className="h-8 w-8">
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteQuiz(quiz.id)} className="h-8 w-8 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleToggleExpand(quiz.id)} className="h-8 w-8">
                  {expandedQuizId === quiz.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {expandedQuizId === quiz.id && (
              <div className="border-t border-border/30 p-4 bg-muted/10">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Items ({existingItems[quiz.id]?.length || 0})
                </h4>
                <div className="space-y-1">
                  {(existingItems[quiz.id] || []).map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-3 bg-card rounded-lg px-3 py-2 text-sm">
                      <span className="text-muted-foreground w-6 text-center">{idx + 1}</span>
                      {item.display_value && (
                        <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded min-w-[40px] text-center">
                          {item.display_value}
                        </span>
                      )}
                      <span className="flex-1 font-medium text-foreground">{item.answer}</span>
                      {item.acceptable_answers && item.acceptable_answers.length > 0 && (
                        <span className="text-muted-foreground text-xs">
                          ({item.acceptable_answers.join(", ")})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuizAdmin;
