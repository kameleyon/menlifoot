/** Derive a thumbnail for a podcast — from thumbnail_url, else a YouTube video id, else null. */
export const podcastThumb = (p: {
  thumbnail_url?: string | null;
  embed_url?: string | null;
  original_url?: string | null;
}): string | null => {
  if (p.thumbnail_url) return p.thumbnail_url;
  const url = `${p.embed_url ?? ''} ${p.original_url ?? ''}`;
  const m =
    url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/) ||
    url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ||
    url.match(/shorts\/([A-Za-z0-9_-]{6,})/) ||
    url.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  return m?.[1] ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
};
