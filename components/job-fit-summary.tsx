"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  roleTypeId: string;
  jobListingId: string;
  className?: string;
};

export function JobFitSummary({
  roleTypeId,
  jobListingId,
  className,
}: Props) {
  const [expanded, setExpanded] = React.useState(false);
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const load = React.useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setText("");

    try {
      const res = await fetch("/api/ai/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          roleTypeId,
          jobListingId,
        }),
      });

      if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }

      if (!res.body) {
        throw new Error("No response body");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setText(accumulated);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message || "Could not load fit summary");
    } finally {
      setLoading(false);
    }
  }, [jobListingId, roleTypeId]);

  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && !text && !loading) {
      void load();
    }
  }

  return (
    <div className={cn("mt-2", className)}>
      <button
        type="button"
        onClick={toggle}
        className="text-xs font-medium text-primary hover:underline"
        aria-expanded={expanded}
      >
        {expanded ? "Hide fit summary" : "Why this might fit"}
      </button>
      {expanded && (
        <div className="mt-1.5 text-sm text-muted-foreground">
          {loading && !text ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Generating…
            </span>
          ) : null}
          {error ? (
            <p className="text-destructive">{error}</p>
          ) : text ? (
            <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
