"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { FileText, Loader2 } from "lucide-react";

const READING_STEPS = [
  "Fetching page…",
  "Reading HTML…",
  "Finding careers listing…",
  "Analyzing with AI…",
] as const;

const DISCOVERING_STEPS = [
  "Searching careers site…",
  "Scoring similar roles…",
  "Adding jobs to your search…",
] as const;

type Props = {
  phase: "reading" | "discovering";
  url?: string;
  className?: string;
};

export function JobUrlReadingPanel({ phase, url, className }: Props) {
  const steps = phase === "reading" ? READING_STEPS : DISCOVERING_STEPS;
  const [stepIndex, setStepIndex] = React.useState(0);

  React.useEffect(() => {
    setStepIndex(0);
    const id = window.setInterval(() => {
      setStepIndex((i) => (i + 1) % steps.length);
    }, 1800);
    return () => window.clearInterval(id);
  }, [steps.length, phase]);

  const label = steps[stepIndex];

  return (
    <div
      className={cn(
        "min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-muted/30 p-4",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex min-w-0 w-full items-start gap-3">
        <div
          className="relative isolate shrink-0 w-[4.5rem] h-[5.5rem] rounded-md border border-border bg-background overflow-hidden shadow-sm"
          aria-hidden
        >
          <div className="absolute inset-0 overflow-hidden p-2 space-y-1.5">
            <div className="h-1.5 w-8 rounded-full bg-muted-foreground/25 animate-pulse" />
            <div className="h-1 w-full rounded-full bg-muted-foreground/15 animate-pulse [animation-delay:120ms]" />
            <div className="h-1 w-[85%] rounded-full bg-muted-foreground/15 animate-pulse [animation-delay:240ms]" />
            <div className="h-1 w-full rounded-full bg-muted-foreground/15 animate-pulse [animation-delay:360ms]" />
            <div className="h-1 w-[70%] rounded-full bg-muted-foreground/15 animate-pulse [animation-delay:480ms]" />
            <div className="h-1 w-[90%] rounded-full bg-muted-foreground/15 animate-pulse [animation-delay:600ms]" />
          </div>
          <div className="absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-primary/0 via-primary/30 to-primary/0 job-page-scan pointer-events-none" />
          <FileText className="absolute bottom-1.5 right-1.5 z-20 size-3.5 text-muted-foreground/40" />
        </div>

        <div className="min-w-0 flex-1 overflow-hidden pt-0.5 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            <p className="min-w-0 truncate text-sm font-medium">{label}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {phase === "reading"
              ? "Downloading and parsing the job posting page."
              : "Looking for similar roles on the same careers site."}
          </p>
          {url ? (
            <p className="text-xs text-muted-foreground truncate" title={url}>
              {url}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
