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
    case "code":
    case "pre":
    case "span":
      return React.createElement(tag, { key }, children);
    case "br":
      return <br key={key} />;
    case "hr":
      return <hr key={key} />;
    case "a": {
      const href = el.getAttribute("href") ?? "";
      if (!isSafeHttpUrl(href)) return <span key={key}>{children}</span>;
      return (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    }
    case "img": {
      const src = el.getAttribute("src") ?? "";
      if (!isSafeHttpUrl(src)) return null;
      const alt = el.getAttribute("alt") ?? "";
      return <img key={key} src={src} alt={alt} loading="lazy" />;
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
