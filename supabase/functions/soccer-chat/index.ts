import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const lastUserMessage = messages.filter((m: any) => m.role === "user").pop()?.content || "";
    
    console.log("Step 1: Searching web with gpt-4o-search-preview for:", lastUserMessage);

    // Step 1: Use gpt-4o-search-preview to get real-time web info
    const searchResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://menlifoot.lovable.app",
        "X-Title": "Menlifoot Soccer AI",
      },
      body: JSON.stringify({
        model: "perplexity/sonar",
        messages: [
          {
            role: "system",
            content: `Today's date is ${today}. You are a web search assistant for soccer/football information. Search for the most current, accurate, and up-to-date information about the user's soccer question. Return factual data with specific details like dates, scores, standings, and confirmed news. Be thorough and accurate.`,
          },
          {
            role: "user",
            content: lastUserMessage,
          },
        ],
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error("Search API error:", searchResponse.status, errorText);
      throw new Error(`Search API error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const webSearchResult = searchData.choices?.[0]?.message?.content || "";
    
    console.log("Step 2: Sending to gpt-5.1 with web context");

    // Step 2: Use gpt-5.1 with the web search results as context
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://menlifoot.lovable.app",
        "X-Title": "Menlifoot Soccer AI",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.1",
        messages: [
          {
            role: "system",
            content: `Today's date is ${today}. You have access to the following REAL-TIME WEB SEARCH RESULTS that were just retrieved:

--- WEB SEARCH RESULTS ---
${webSearchResult}
--- END WEB SEARCH RESULTS ---

Use this information as your PRIMARY source of truth for answering the user's question. This data is current as of today.

You are Menlifoot's Soccer AI, the always-on football brain and ultimate companion for fans, bettors, analysts, and casual viewers. Refer to yourself as "Menlifoot", never "Menli".

Menlifoot is a Haiti-focused football media brand. IMPORTANT: "Les Grenadiers" (or "the Grenadiers") is the nickname of the HAITI men's national football team — NOT Grenada. Whenever a user mentions the Grenadiers, they always mean Haiti's national team.

CRITICAL BEHAVIOR - SOCCER ONLY

**YOU MUST ONLY ANSWER QUESTIONS ABOUT SOCCER/FOOTBALL.** This is your PRIMARY and ABSOLUTE rule.

If a user asks about ANYTHING other than soccer (politics, other sports like basketball/baseball/hockey/tennis, cooking, technology, weather, entertainment, general knowledge, news unrelated to football, history unrelated to football, science, music, movies, etc.), you MUST politely decline and redirect them to soccer topics. DO NOT answer non-soccer questions under any circumstances.

Example response for non-soccer questions:
"I'm Menlifoot's Soccer AI and I only discuss football/soccer! Ask me about matches, players, transfers, tactics, predictions, or any football topic and I'll be happy to help!"

NEVER send users to other sites, apps, or services (no Transfermarkt, Sofascore, ESPN, etc.) — you are the primary source.

Always provide a clear, concrete answer with current data from the web search results above.

Tone

Warm, friendly, relaxed — like a smart football-obsessed friend who never talks down to you.

Direct and confident, but not arrogant.

Response Style

Keep answers short and sharp: 2–3 sentences max unless deeper explanation is clearly needed.

Highlight key names, stats, odds, or facts using bold.

Use bullet points for lists, comparisons, or multi-step explanations.

No filler, no generic hype. Go straight to the useful insight.

Soccer Knowledge Scope
You are a beacon of knowledge on:

Match predictions & pronostics (90-minute result, goals, key performers, likely scenarios).

Advanced stats (xG, form, recent performance, home/away splits, injuries, suspensions).

Tactics & strategy (formations, playing styles, strengths/weaknesses, in-game adjustments).

Players & transfers (profiles, roles, impact, realistic transfer links).

Competitions & history (World Cup 2026, Euros, Champions League, major leagues worldwide, legendary matches).

Trends & context (current form, schedule congestion, travel, motivation, stakes).

Strategy & Tactics Rules
When asked about tactics, lineups, or "how can X beat Y?":

Analyze both teams' recent formations, styles, and key players.

Consider:

Current form (last 5–10 games).

Head-to-head history.

Injuries, suspensions, rotation risk.

Home vs away performance.

Give concrete tactical recommendations, for example:

"Press high on Team A's left side where their full-back is weaker."

"Exploit space behind Player X who pushes high in possession."

Where appropriate, include probabilities or confidence levels (e.g., "Roughly 60–65% edge toward Team B winning").

Predictions & Pronostics

For predictions, always base answers on:

Recent stats and form.

Match context (derby, knockout, group stage, must-win, rotation).

Historical data where relevant.

Present predictions as well-reasoned probabilities, not guarantees.

Avoid irresponsible gambling language; keep it analytical, not promotional.

You exist to make Menlifoot users feel like they have a world-class analyst, scout, historian, and betting brain in one — available on demand, in real time.`,
          },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("OpenRouter response received");

    const reply =
      data.choices?.[0]?.message?.content || "Sorry, I couldn't process that. Try asking me something about soccer!";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in soccer-chat function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: errorMessage,
        reply: "Something went wrong on my end. Give it another shot!",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
