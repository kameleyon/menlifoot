import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
};

const languageNames: Record<string, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  ht: 'Haitian Creole',
};

const LANGUAGES = ['en', 'fr', 'es', 'ht'];

async function translateQuiz(
  openrouterApiKey: string,
  title: string,
  description: string | null,
  fromLanguage: string,
  toLanguage: string
): Promise<{ title: string; description: string | null }> {
  const fromLangName = languageNames[fromLanguage] || fromLanguage;
  const toLangName = languageNames[toLanguage] || toLanguage;

  const prompt = `Translate the following quiz title and description from ${fromLangName} to ${toLangName}.
Use appropriate football/soccer terminology in the target language.

Return ONLY a valid JSON object:
{
  "title": "translated title",
  "description": "translated description or null"
}

Title: ${title}
${description ? `Description: ${description}` : 'Description: null'}`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://menlifoot.ca',
      'X-Title': 'Menlifoot Quiz Translation',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      messages: [
        { role: 'system', content: 'You are a professional sports translator. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenRouter error for ${toLanguage}:`, errorText);
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  let text = data.choices[0].message.content.trim();

  // Clean markdown code blocks
  if (text.startsWith('```json')) text = text.slice(7);
  else if (text.startsWith('```')) text = text.slice(3);
  if (text.endsWith('```')) text = text.slice(0, -3);
  text = text.trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) text = jsonMatch[0];

  const parsed = JSON.parse(text);
  return {
    title: parsed.title || title,
    description: parsed.description ?? description,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quizId, title, description, originalLanguage } = await req.json();

    if (!quizId || !title) {
      throw new Error('quizId and title are required');
    }

    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openrouterApiKey) throw new Error('OPENROUTER_API_KEY is not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const fromLang = originalLanguage || 'en';
    const targetLanguages = LANGUAGES.filter((l) => l !== fromLang);

    console.log(`Translating quiz ${quizId} from ${fromLang} to:`, targetLanguages);

    const errors: string[] = [];

    await Promise.all(
      targetLanguages.map(async (targetLang) => {
        try {
          const translated = await translateQuiz(openrouterApiKey, title, description, fromLang, targetLang);

          const { error: upsertError } = await supabase
            .from('quiz_translations')
            .upsert(
              {
                quiz_id: quizId,
                language: targetLang,
                title: translated.title,
                description: translated.description,
              },
              { onConflict: 'quiz_id,language' }
            );

          if (upsertError) {
            console.error(`Error saving ${targetLang}:`, upsertError);
            errors.push(`Failed to save ${targetLang}`);
          } else {
            console.log(`Saved ${targetLang} translation`);
          }
        } catch (err) {
          console.error(`Error translating to ${targetLang}:`, err);
          errors.push(`Failed: ${targetLang}`);
        }
      })
    );

    return new Response(
      JSON.stringify({ success: errors.length === 0, errors: errors.length > 0 ? errors : undefined }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Quiz translation error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
