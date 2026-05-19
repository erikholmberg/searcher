"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { stripHtml } from "@/lib/jobs/utils";
import type { JobListingDto } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  roleTypeName: string;
  roleTypeIntent?: string | null;
  listing: JobListingDto;
  className?: string;
};

export function JobFitSummary({
  roleTypeName,
  roleTypeIntent,
  listing,
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
      const snippet = listing.descriptionSnippet
        ? stripHtml(listing.descriptionSnippet, 2000)
        : undefined;

      const res = await fetch("/api/ai/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          roleTypeName,
          roleTypeIntent: roleTypeIntent ?? undefined,
          job: {
            title: listing.title,
            company: listing.company,
            snippet,
            locationDisplay: listing.locationDisplay ?? undefined,
            workMode: listing.workMode,
          },
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
  }, [listing, roleTypeIntent, roleTypeName]);

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
