import type { Config, Context } from "@netlify/edge-functions";

export default async (request: Request, context: Context) => {
  // 1. Identify if the visitor is a social media bot
  const userAgent = request.headers.get("user-agent")?.toLowerCase() || "";
  const isBot = /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram|discordbot|slackbot|googlebot|bingbot|yandex|baiduspider/i.test(userAgent);

  // 2. If it's a bot requesting an article...
  if (isBot) {
    const url = new URL(request.url);
    // Extract the Article ID from the URL (e.g., /articles/123-456)
    const match = url.pathname.match(/\/articles\/([a-f0-9-]+)/);
    
    if (match) {
      const articleId = match[1];
      console.log(`Bot detected for article ${articleId}. Proxying to Supabase...`);
      
      // 3. Fetch the HTML with meta tags from your existing Supabase function
      const supabaseUrl = "https://tjotexujwnfltszqqovk.supabase.co/functions/v1/article-share";
      return fetch(`${supabaseUrl}?id=${articleId}`);
    }
  }

  // 4. If it's a human, let them through to the React App
  return context.next();
};

// Configure this function to run only on article pages
export const config: Config = {
  path: "/articles/*",
};
