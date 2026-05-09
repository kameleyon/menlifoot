import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
    fetch(url, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) setStatus("valid");
        else if (d.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setStatus("submitting");
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    if (error || !data?.success) setStatus("error");
    else setStatus("done");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6 glass-card p-8">
        <h1
          className="text-3xl uppercase tracking-wider text-gradient-gold"
          style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 300 }}
        >
          Email preferences
        </h1>

        {status === "loading" && (
          <Loader2 className="h-10 w-10 text-primary mx-auto animate-spin" />
        )}

        {status === "valid" && (
          <>
            <p className="text-muted-foreground">
              Click below to unsubscribe from Menlifoot emails.
            </p>
            <Button variant="gold" size="lg" className="w-full" onClick={handleConfirm}>
              Confirm unsubscribe
            </Button>
          </>
        )}

        {status === "submitting" && (
          <Loader2 className="h-10 w-10 text-primary mx-auto animate-spin" />
        )}

        {status === "done" && (
          <>
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <p className="text-muted-foreground">
              You've been unsubscribed. We're sorry to see you go.
            </p>
          </>
        )}

        {status === "already" && (
          <>
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <p className="text-muted-foreground">You're already unsubscribed.</p>
          </>
        )}

        {(status === "invalid" || status === "error") && (
          <>
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-muted-foreground">
              This unsubscribe link is invalid or has expired.
            </p>
          </>
        )}

        <Link to="/">
          <Button variant="outline" className="w-full">
            Back to Menlifoot
          </Button>
        </Link>
      </div>
    </div>
  );
}
