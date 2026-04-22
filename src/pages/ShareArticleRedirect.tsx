import { useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";

/**
 * Handles legacy /share/articles/:id URLs.
 * Lovable hosting does not run Netlify edge functions, so we redirect
 * humans straight to the canonical article page client-side.
 */
const ShareArticleRedirect = () => {
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    // Best-effort: if for some reason Navigate doesn't run, force a hard redirect
    if (id && typeof window !== "undefined") {
      const target = `/articles/${id}`;
      if (window.location.pathname !== target) {
        // small delay to allow Navigate to handle it first
        const t = setTimeout(() => {
          window.location.replace(target);
        }, 100);
        return () => clearTimeout(t);
      }
    }
  }, [id]);

  if (!id) return <Navigate to="/" replace />;
  return <Navigate to={`/articles/${id}`} replace />;
};

export default ShareArticleRedirect;
