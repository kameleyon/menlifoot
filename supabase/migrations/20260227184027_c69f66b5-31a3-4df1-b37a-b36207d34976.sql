
-- Create quizzes table
CREATE TABLE public.quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  time_limit_seconds INTEGER NOT NULL DEFAULT 300,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quiz_items table
CREATE TABLE public.quiz_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  acceptable_answers TEXT[],
  hint TEXT,
  display_value TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quiz_attempts table
CREATE TABLE public.quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id UUID,
  score INTEGER NOT NULL DEFAULT 0,
  total_items INTEGER NOT NULL DEFAULT 0,
  time_taken_seconds INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Quizzes: anyone can read published
CREATE POLICY "Anyone can view published quizzes"
ON public.quizzes FOR SELECT
USING (is_published = true);

-- Quizzes: admin/editor can manage
CREATE POLICY "Admins and editors can manage quizzes"
ON public.quizzes FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

-- Quiz items: anyone can read
CREATE POLICY "Anyone can view quiz items"
ON public.quiz_items FOR SELECT
USING (EXISTS (SELECT 1 FROM public.quizzes WHERE quizzes.id = quiz_items.quiz_id AND quizzes.is_published = true));

-- Quiz items: admin/editor can manage
CREATE POLICY "Admins and editors can manage quiz items"
ON public.quiz_items FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

-- Quiz attempts: anyone can insert
CREATE POLICY "Anyone can submit quiz attempts"
ON public.quiz_attempts FOR INSERT
WITH CHECK (true);

-- Quiz attempts: users can read own
CREATE POLICY "Users can view their own attempts"
ON public.quiz_attempts FOR SELECT
USING (user_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER update_quizzes_updated_at
BEFORE UPDATE ON public.quizzes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for quiz items lookup
CREATE INDEX idx_quiz_items_quiz_id ON public.quiz_items(quiz_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON public.quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
