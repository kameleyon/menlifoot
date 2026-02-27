
CREATE TABLE public.quiz_translations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, language)
);

ALTER TABLE public.quiz_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quiz translations are publicly readable"
ON public.quiz_translations FOR SELECT USING (true);

CREATE POLICY "Admins and editors can manage quiz translations"
ON public.quiz_translations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE TRIGGER update_quiz_translations_updated_at
BEFORE UPDATE ON public.quiz_translations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
