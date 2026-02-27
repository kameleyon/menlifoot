import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
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
  DialogTrigger,
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

const QuizAdmin = ({ userId }: { userId: string | undefined }) => {
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);
  const [quizItems, setQuizItems] = useState<Record<string, QuizItem[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Quiz form
  const [quizForm, setQuizForm] = useState({
    title: "",
    description: "",
    thumbnail_url: "",
    time_limit_seconds: 300,
    is_published: false,
  });

  // Item form
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QuizItem | null>(null);
  const [itemFormQuizId, setItemFormQuizId] = useState<string>("");
  const [itemForm, setItemForm] = useState({
    answer: "",
    acceptable_answers: "",
    hint: "",
    display_value: "",
    sort_order: 0,
  });

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
      setQuizItems((prev) => ({ ...prev, [quizId]: data || [] }));
    }
  };

  const handleToggleExpand = (quizId: string) => {
    if (expandedQuizId === quizId) {
      setExpandedQuizId(null);
    } else {
      setExpandedQuizId(quizId);
      if (!quizItems[quizId]) fetchQuizItems(quizId);
    }
  };

  const resetQuizForm = () => {
    setQuizForm({ title: "", description: "", thumbnail_url: "", time_limit_seconds: 300, is_published: false });
  };

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setQuizForm({
      title: quiz.title,
      description: quiz.description || "",
      thumbnail_url: quiz.thumbnail_url || "",
      time_limit_seconds: quiz.time_limit_seconds,
      is_published: quiz.is_published,
    });
    setIsQuizDialogOpen(true);
  };

  const handleQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const data = {
      title: quizForm.title,
      description: quizForm.description || null,
      thumbnail_url: quizForm.thumbnail_url || null,
      time_limit_seconds: quizForm.time_limit_seconds,
      is_published: quizForm.is_published,
      created_by: userId || null,
    };

    try {
      if (editingQuiz) {
        const { error } = await supabase.from("quizzes").update(data).eq("id", editingQuiz.id);
        if (error) throw error;
        toast({ title: "Success", description: "Quiz updated!" });
      } else {
        const { error } = await supabase.from("quizzes").insert([data]);
        if (error) throw error;
        toast({ title: "Success", description: "Quiz created!" });
      }
      setIsQuizDialogOpen(false);
      setEditingQuiz(null);
      resetQuizForm();
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
      toast({ title: "Deleted", description: "Quiz removed." });
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

  // Items
  const resetItemForm = () => {
    setItemForm({ answer: "", acceptable_answers: "", hint: "", display_value: "", sort_order: 0 });
  };

  const openAddItem = (quizId: string) => {
    setItemFormQuizId(quizId);
    setEditingItem(null);
    const items = quizItems[quizId] || [];
    setItemForm({
      answer: "",
      acceptable_answers: "",
      hint: "",
      display_value: "",
      sort_order: items.length + 1,
    });
    setIsItemDialogOpen(true);
  };

  const openEditItem = (item: QuizItem) => {
    setItemFormQuizId(item.quiz_id);
    setEditingItem(item);
    setItemForm({
      answer: item.answer,
      acceptable_answers: (item.acceptable_answers || []).join(", "),
      hint: item.hint || "",
      display_value: item.display_value || "",
      sort_order: item.sort_order,
    });
    setIsItemDialogOpen(true);
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const acceptableArr = itemForm.acceptable_answers
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const data = {
      quiz_id: itemFormQuizId,
      answer: itemForm.answer,
      acceptable_answers: acceptableArr.length > 0 ? acceptableArr : null,
      hint: itemForm.hint || null,
      display_value: itemForm.display_value || null,
      sort_order: itemForm.sort_order,
    };

    try {
      if (editingItem) {
        const { error } = await supabase.from("quiz_items").update(data).eq("id", editingItem.id);
        if (error) throw error;
        toast({ title: "Success", description: "Item updated!" });
      } else {
        const { error } = await supabase.from("quiz_items").insert([data]);
        if (error) throw error;
        toast({ title: "Success", description: "Item added!" });
      }
      setIsItemDialogOpen(false);
      setEditingItem(null);
      resetItemForm();
      fetchQuizItems(itemFormQuizId);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async (item: QuizItem) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("quiz_items").delete().eq("id", item.id);
    if (!error) {
      toast({ title: "Deleted" });
      fetchQuizItems(item.quiz_id);
    }
  };

  return (
    <div>
      {/* Quiz Dialog */}
      <Dialog
        open={isQuizDialogOpen}
        onOpenChange={(open) => {
          setIsQuizDialogOpen(open);
          if (!open) { setEditingQuiz(null); resetQuizForm(); }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="gold" className="mb-6">
            <Plus className="h-4 w-4 mr-2" />
            Add Quiz
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingQuiz ? "Edit Quiz" : "New Quiz"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleQuizSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={quizForm.title}
                onChange={(e) => setQuizForm((p) => ({ ...p, title: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={quizForm.description}
                onChange={(e) => setQuizForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Thumbnail URL</Label>
              <Input
                value={quizForm.thumbnail_url}
                onChange={(e) => setQuizForm((p) => ({ ...p, thumbnail_url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Time Limit (seconds)</Label>
              <Input
                type="number"
                value={quizForm.time_limit_seconds}
                onChange={(e) => setQuizForm((p) => ({ ...p, time_limit_seconds: parseInt(e.target.value) || 300 }))}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={quizForm.is_published}
                onCheckedChange={(v) => setQuizForm((p) => ({ ...p, is_published: v }))}
              />
              <Label>Published</Label>
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={isLoading}>
              {isLoading ? "Saving..." : editingQuiz ? "Update Quiz" : "Create Quiz"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog
        open={isItemDialogOpen}
        onOpenChange={(open) => {
          setIsItemDialogOpen(open);
          if (!open) { setEditingItem(null); resetItemForm(); }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add Item"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleItemSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Answer *</Label>
              <Input
                value={itemForm.answer}
                onChange={(e) => setItemForm((p) => ({ ...p, answer: e.target.value }))}
                placeholder="e.g. Cristiano Ronaldo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Acceptable Answers (comma-separated)</Label>
              <Input
                value={itemForm.acceptable_answers}
                onChange={(e) => setItemForm((p) => ({ ...p, acceptable_answers: e.target.value }))}
                placeholder="e.g. CR7, Ronaldo"
              />
            </div>
            <div className="space-y-2">
              <Label>Display Value</Label>
              <Input
                value={itemForm.display_value}
                onChange={(e) => setItemForm((p) => ({ ...p, display_value: e.target.value }))}
                placeholder="e.g. 85"
              />
            </div>
            <div className="space-y-2">
              <Label>Hint</Label>
              <Input
                value={itemForm.hint}
                onChange={(e) => setItemForm((p) => ({ ...p, hint: e.target.value }))}
                placeholder="Optional hint for logged-in users"
              />
            </div>
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={itemForm.sort_order}
                onChange={(e) => setItemForm((p) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={isLoading}>
              {isLoading ? "Saving..." : editingItem ? "Update Item" : "Add Item"}
            </Button>
          </form>
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
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={() => handleTogglePublish(quiz)} className="h-8 w-8">
                  <Switch checked={quiz.is_published} className="pointer-events-none" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleEditQuiz(quiz)} className="h-8 w-8">
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

            {/* Expanded items */}
            {expandedQuizId === quiz.id && (
              <div className="border-t border-border/30 p-4 bg-muted/10">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Quiz Items ({quizItems[quiz.id]?.length || 0})</h4>
                  <Button variant="outline" size="sm" onClick={() => openAddItem(quiz.id)}>
                    <Plus className="h-3 w-3 mr-1" /> Add Item
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {(quizItems[quiz.id] || []).map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-3 bg-card rounded-lg px-3 py-2 text-sm">
                      <span className="text-muted-foreground w-6 text-center">{idx + 1}</span>
                      <span className="flex-1 font-medium text-foreground">{item.answer}</span>
                      {item.display_value && (
                        <span className="text-muted-foreground text-xs">{item.display_value}</span>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(item)}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteItem(item)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
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
