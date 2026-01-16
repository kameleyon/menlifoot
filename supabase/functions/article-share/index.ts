import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const articleId = url.searchParams.get("id");

    console.log("Article share request for ID:", articleId);

    if (!articleId) {
      return new Response("Missing article ID", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: article, error } = await supabase
      .from("articles")
      .select("title, summary, content, thumbnail_url, author, published_at")
      .eq("id", articleId)
      .eq("is_published", true)
      .maybeSingle();

    console.log("Article fetch result:", { article: article?.title, error });

    if (error || !article) {
      // Redirect to homepage if article not found
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": "https://menlifoot.ca",
        },
      });
    }

    // Generate description from summary or content
    const description = article.summary || 
      article.content.substring(0, 160).replace(/\s+/g, ' ').trim() + "...";
    
    const imageUrl = article.thumbnail_url || "https://menlifoot.ca/og-image.png";
    const articleUrl = `https://menlifoot.ca/articles/${articleId}`;
    const siteName = "Menlifoot";

    // Create the HTML page with proper OG meta tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(article.title)} | ${siteName}</title>
    
    <!-- Primary Meta Tags -->
    <meta name="title" content="${escapeHtml(article.title)}">
    <meta name="description" content="${escapeHtml(description)}">
    ${article.author ? `<meta name="author" content="${escapeHtml(article.author)}">` : ''}
    
    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="${articleUrl}">
    <meta property="og:title" content="${escapeHtml(article.title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="${siteName}">
    ${article.published_at ? `<meta property="article:published_time" content="${article.published_at}">` : ''}
    ${article.author ? `<meta property="article:author" content="${escapeHtml(article.author)}">` : ''}
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${articleUrl}">
    <meta name="twitter:title" content="${escapeHtml(article.title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${imageUrl}">
    <meta name="twitter:site" content="@Menlifoot">
    
    <!-- Canonical -->
    <link rel="canonical" href="${articleUrl}">
    
    <!-- Redirect to actual article after meta tags are read -->
    <meta http-equiv="refresh" content="0;url=${articleUrl}">
    <script>window.location.href = "${articleUrl}";</script>
</head>
<body>
    <p>Redirecting to <a href="${articleUrl}">${escapeHtml(article.title)}</a>...</p>
</body>
</html>`;

    console.log("Returning HTML with OG tags for:", article.title);

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": "https://menlifoot.ca",
      },
    });
  }
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
