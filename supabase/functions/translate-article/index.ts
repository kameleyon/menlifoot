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
  ht: 'Haitian Creole'
};

const LANGUAGES = ['en', 'fr', 'es', 'ht'];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      articleId, 
      title, 
      subtitle, 
      summary, 
      content, 
      keywords, 
      fromLanguage, 
      toLanguage,
      saveToDb = false 
    } = await req.json();

    // If same language, return original content
    if (fromLanguage === toLanguage) {
      return new Response(JSON.stringify({ 
        title, 
        subtitle, 
        summary, 
        content,
        keywords 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fromLangName = languageNames[fromLanguage] || fromLanguage;
    const toLangName = languageNames[toLanguage] || toLanguage;

    const prompt = `You are a professional translator. Translate the following article content from ${fromLangName} to ${toLangName}. 
Maintain the original meaning, tone, and style. For sports/football terminology, use the appropriate terms in the target language.

IMPORTANT: Return ONLY a valid JSON object with these exact keys (no markdown, no code blocks, just raw JSON):
{
  "title": "translated title",
  "subtitle": "translated subtitle or null",
  "summary": "translated summary or null", 
  "content": "translated content",
  "keywords": ["translated", "keywords", "array"]
}

Article to translate:
Title: ${title}
${subtitle ? `Subtitle: ${subtitle}` : ''}
${summary ? `Summary: ${summary}` : ''}
Content: ${content}
${keywords && keywords.length > 0 ? `Keywords: ${keywords.join(', ')}` : ''}`;

    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openrouterApiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    console.log(`Translating article from ${fromLanguage} to ${toLanguage} using OpenRouter Claude Sonnet 4.5`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://menlifoot.ca',
        'X-Title': 'Menlifoot Translation'
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.6-luna',
        messages: [
          { role: 'system', content: 'You are a professional translator specializing in sports journalism. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      
      // On rate limit or payment issues, return original content gracefully
      if (response.status === 402 || response.status === 429) {
        console.log('OpenRouter rate limited or payment required, returning original content');
        return new Response(JSON.stringify({ 
          title, 
          subtitle, 
          summary, 
          content,
          keywords,
          _translationSkipped: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const translatedText = data.choices[0].message.content;
    
    // Parse the JSON response
    let translated;
    try {
      // Clean up potential markdown code blocks
      let cleanedText = translatedText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.slice(7);
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.slice(3);
      }
      if (cleanedText.endsWith('```')) {
        cleanedText = cleanedText.slice(0, -3);
      }
      translated = JSON.parse(cleanedText.trim());
    } catch (parseError) {
      console.error('Failed to parse translation response:', translatedText);
      // Return original if parsing fails
      translated = { title, subtitle, summary, content, keywords };
    }

    // Save to database if requested
    if (saveToDb && articleId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { error: upsertError } = await supabase
          .from('article_translations')
          .upsert({
            article_id: articleId,
            language: toLanguage,
            title: translated.title || title,
            subtitle: translated.subtitle || subtitle,
            summary: translated.summary || summary,
            content: translated.content || content,
            keywords: translated.keywords || keywords
          }, {
            onConflict: 'article_id,language'
          });

        if (upsertError) {
          console.error('Error saving translation to DB:', upsertError);
        } else {
          console.log(`Translation saved to DB for article ${articleId} in ${toLanguage}`);
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
    }

    return new Response(JSON.stringify(translated), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Translation error:', error);
    // On any error, return original content instead of breaking the page
    const { title, subtitle, summary, content, keywords } = await req.clone().json().catch(() => ({}));
    return new Response(JSON.stringify({ 
      title: title || '', 
      subtitle: subtitle || null, 
      summary: summary || null, 
      content: content || '',
      keywords: keywords || [],
      _error: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
