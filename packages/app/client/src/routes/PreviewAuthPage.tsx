import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { ApiError, request } from "../lib/api";
import { Button } from "../components/ui";
import { Wordmark } from "../components/Wordmark";

// Where the preview router sends a visitor who has no preview cookie. Reaching this page at all
// means the app's own sign-in has already run, so all that is left is the membership check and the
// hand-back: a single-use code on the preview host, which the router turns into a host-only cookie.
export function PreviewAuthPage() {
  const [params] = useSearchParams();
  const host = params.get("host") ?? "";
  const next = params.get("next") ?? "/";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!host) {
      setError("That link is missing the preview it was for.");
      return;
    }
    void request<{ redirect: string }>("/previews/auth-code", { method: "POST", body: JSON.stringify({ host, next }) })
      .then((res) => {
        if (!cancelled) window.location.replace(res.redirect);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError && typeof (err.data as { error?: string })?.error === "string" ? (err.data as { error: string }).error : "That preview could not be opened.");
      });
    return () => {
      cancelled = true;
    };
  }, [host, next]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <Wordmark />
      <div className="max-w-sm">
        <h1 className="text-lg font-semibold text-ink">{error ? "This preview isn't open to you" : "Opening the preview"}</h1>
        <p className="mt-2 text-sm text-ink-muted">{error ?? `Checking your access to ${host}.`}</p>
      </div>
      {error ? (
        <Button variant="ghost" onClick={() => window.location.assign("/")}>
          Back to your boards
        </Button>
      ) : null}
    </div>
  );
}
