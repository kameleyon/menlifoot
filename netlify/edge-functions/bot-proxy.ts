import type { Config, Context } from "@netlify/edge-functions";

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const userAgent = request.headers.get("user-agent")?.toLowerCase() || "";
  const isBot = /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram|discordbot|slackbot|googlebot|bingbot|yandex|baiduspider/i.test(userAgent);

  // Handle /share/articles/:id URLs
  if (url.pathname.startsWith("/share/articles/")) {
    const articleId = url.pathname.replace("/share/articles/", "");
    
    if (isBot) {
      // Bots get OG meta tags from Supabase function
      console.log(`Bot detected for shared article ${articleId}. Proxying to Supabase...`);
      const supabaseUrl = "https://tjotexujwnfltszqqovk.supabase.co/functions/v1/article-share";
      return fetch(`${supabaseUrl}?id=${articleId}`);
    } else {
      // Humans get redirected to the real article URL
      console.log(`Human detected for shared article ${articleId}. Redirecting...`);
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `/articles/${articleId}`,
        },
      });
    }
  }

  // Handle /articles/:id URLs (existing logic)
  if (isBot) {
    const match = url.pathname.match(/\/articles\/([a-f0-9-]+)/);
    
    if (match) {
      const articleId = match[1];
      console.log(`Bot detected for article ${articleId}. Proxying to Supabase...`);
      const supabaseUrl = "https://tjotexujwnfltszqqovk.supabase.co/functions/v1/article-share";
      return fetch(`${supabaseUrl}?id=${articleId}`);
    }
  }

  // Human traffic passes through to the React App
  return context.next();
};

// Configure this function to run on article pages and share URLs
export const config: Config = {
  path: ["/articles/*", "/share/articles/*"],
};
