import React, { useEffect, useMemo } from "react";

type Props = {
  html: string;
  className?: string;
};

const isSafeHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const getYouTubeEmbedSrc = (rawUrl: string): string | null => {
  if (!isSafeHttpUrl(rawUrl)) return null;
  const url = new URL(rawUrl);

  if (url.hostname.includes("youtube.com")) {
    if (url.pathname === "/watch") {
      const v = url.searchParams.get("v");
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }

    const shortsMatch = url.pathname.match(/^\/shorts\/([^/]+)/);
    if (shortsMatch?.[1]) return `https://www.youtube.com/embed/${shortsMatch[1]}`;

    const embedMatch = url.pathname.match(/^\/embed\/([^/]+)/);
    if (embedMatch?.[1]) return `https://www.youtube.com/embed/${embedMatch[1]}`;
  }

  if (url.hostname === "youtu.be") {
    const id = url.pathname.replace(/^\//, "");
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  return null;
};

const isXUrl = (rawUrl: string) => {
  if (!isSafeHttpUrl(rawUrl)) return false;
  const url = new URL(rawUrl);
  return url.hostname === "x.com" || url.hostname === "twitter.com";
};

const YouTubeEmbed = ({ url }: { url: string }) => {
  const src = getYouTubeEmbedSrc(url);
  if (!src) return null;

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-border bg-card/40">
      <div className="aspect-video w-full">
        <iframe
          title="YouTube embed"
          src={src}
          className="h-full w-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
};

const YouTubeIframeEmbed = ({ src }: { src: string }) => {
  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-border bg-card/40">
      <div className="aspect-video w-full">
        <iframe
          title="YouTube embed"
          src={src}
          className="h-full w-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
};

const XEmbed = ({ url }: { url: string }) => {
  useEffect(() => {
    const scriptId = "twitter-widgets";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

    const load = () => {
      // @ts-expect-error - injected by widgets.js
      window.twttr?.widgets?.load?.();
    };

    if (existing) {
      load();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = "https://platform.twitter.com/widgets.js";
    script.onload = load;
    document.body.appendChild(script);
  }, [url]);

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-border bg-card/40 p-4">
      <blockquote className="twitter-tweet">
        <a href={url} target="_blank" rel="noopener noreferrer" />
      </blockquote>
    </div>
  );
};

const isEmbedParagraph = (p: Element): string | null => {
  const meaningfulNodes = Array.from(p.childNodes).filter((n) => {
    if (n.nodeType === Node.TEXT_NODE) return (n.textContent ?? "").trim().length > 0;
    if (n.nodeType === Node.ELEMENT_NODE) return true;
    return false;
  });

  if (meaningfulNodes.length !== 1) return null;
  const only = meaningfulNodes[0];
  if (only.nodeType !== Node.ELEMENT_NODE) return null;

  const el = only as Element;
  if (el.tagName.toLowerCase() !== "a") return null;
  const href = el.getAttribute("href") ?? "";
  if (!isSafeHttpUrl(href)) return null;
  return href;
};

const renderNode = (node: ChildNode, key: string): React.ReactNode => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  // Handle TipTap YouTube embeds (div with data-youtube-video)
  if (tag === "div" && el.hasAttribute("data-youtube-video")) {
    const iframe = el.querySelector("iframe");
    if (iframe) {
      const src = iframe.getAttribute("src") ?? "";
      if (src.includes("youtube.com/embed") || src.includes("youtube-nocookie.com/embed")) {
        return <YouTubeIframeEmbed key={key} src={src} />;
      }
    }
  }

  // Detect embed paragraph (single link that's a video URL)
  if (tag === "p") {
    const href = isEmbedParagraph(el);
    if (href) {
      if (getYouTubeEmbedSrc(href)) return <YouTubeEmbed key={key} url={href} />;
      if (isXUrl(href)) return <XEmbed key={key} url={href} />;
    }
  }

  const children = Array.from(el.childNodes)
    .map((child, i) => renderNode(child, `${key}-${i}`))
    .filter(Boolean);

  // Extract style attribute for inline styles (color, background, font-family)
  const style: React.CSSProperties = {};
  const inlineStyle = el.getAttribute("style");
  if (inlineStyle) {
    const colorMatch = inlineStyle.match(/color:\s*([^;]+)/);
    if (colorMatch) style.color = colorMatch[1].trim();
    const bgMatch = inlineStyle.match(/background-color:\s*([^;]+)/);
    if (bgMatch) style.backgroundColor = bgMatch[1].trim();
    const fontMatch = inlineStyle.match(/font-family:\s*([^;]+)/);
    if (fontMatch) style.fontFamily = fontMatch[1].trim();
  }

  const hasStyle = Object.keys(style).length > 0;

  switch (tag) {
    case "p":
    case "strong":
    case "em":
    case "u":
    case "s":
    case "blockquote":
    case "ol":
    case "ul":
    case "li":
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
    case "code":
    case "pre":
    case "span":
    case "sup":
    case "sub":
    case "mark":
      return React.createElement(tag, { key, ...(hasStyle ? { style } : {}) }, children);
    
    // Task list items
    case "input": {
      const type = el.getAttribute("type");
      if (type === "checkbox") {
        const checked = el.hasAttribute("checked");
        return (
          <input
            key={key}
            type="checkbox"
            checked={checked}
            readOnly
            className="mr-2 rounded border-border"
          />
        );
      }
      return null;
    }
    case "label":
      return <label key={key} className="flex items-start gap-2">{children}</label>;
    
    // Tables
    case "table":
      return (
        <table key={key} className="w-full border-collapse my-4">
          {children}
        </table>
      );
    case "thead":
    case "tbody":
    case "tfoot":
      return React.createElement(tag, { key }, children);
    case "tr":
      return <tr key={key}>{children}</tr>;
    case "th":
      return (
        <th key={key} className="border border-border p-2 bg-muted/50 font-semibold text-left">
          {children}
        </th>
      );
    case "td":
      return (
        <td key={key} className="border border-border p-2">
          {children}
        </td>
      );
    case "colgroup":
    case "col":
      return null; // Skip column definitions
    
    case "br":
      return <br key={key} />;
    case "hr":
      return <hr key={key} className="my-6 border-border" />;
    
    case "a": {
      const href = el.getAttribute("href") ?? "";
      if (!isSafeHttpUrl(href)) return <span key={key}>{children}</span>;
      // If link has no visible text content, display the URL itself
      const hasContent = children.length > 0 && children.some(c => c !== null && c !== '');
      const displayContent = hasContent ? children : href;
      return (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 break-all">
          {displayContent}
        </a>
      );
    }
    
    case "img": {
      const src = el.getAttribute("src") ?? "";
      if (!isSafeHttpUrl(src)) return null;
      const alt = el.getAttribute("alt") ?? "";
      return (
        <img
          key={key}
          src={src}
          alt={alt}
          loading="lazy"
          className="max-w-full h-auto rounded-lg my-4"
        />
      );
    }
    
    case "iframe": {
      const src = el.getAttribute("src") ?? "";
      if (src.includes("youtube.com/embed") || src.includes("youtube-nocookie.com/embed")) {
        return <YouTubeIframeEmbed key={key} src={src} />;
      }
      // Block other iframes for security
      return null;
    }
    
    case "div": {
      // Pass through divs (may contain embeds, task lists, etc.)
      return <div key={key}>{children}</div>;
    }
    
    default:
      return <React.Fragment key={key}>{children}</React.Fragment>;
  }
};

export const RichTextContent = ({ html, className }: Props) => {
  const nodes = useMemo(() => {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    return Array.from(doc.body.childNodes).map((n, i) => renderNode(n, `rt-${i}`));
  }, [html]);

  return <div className={className}>{nodes}</div>;
};
