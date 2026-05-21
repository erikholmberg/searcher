"use client";

import * as React from "react";
import { api } from "@/lib/api-client";
import { stripHtml } from "@/lib/jobs/utils";

type Props = {
  jobListingId: string;
  initialSnippet: string | null;
};

export function JobDescriptionSnippet({ jobListingId, initialSnippet }: Props) {
  const [snippet, setSnippet] = React.useState(initialSnippet);
  const requestedRef = React.useRef(false);

  React.useEffect(() => {
    setSnippet(initialSnippet);
    requestedRef.current = false;
  }, [jobListingId, initialSnippet]);

  React.useEffect(() => {
    if (snippet != null || requestedRef.current) return;
    requestedRef.current = true;
    let cancelled = false;
    void api<{ snippet: string | null }>(
      `/api/jobs/${jobListingId}/snippet`,
    ).then((res) => {
      if (!cancelled && res.snippet) setSnippet(res.snippet);
    });
    return () => {
      cancelled = true;
    };
  }, [jobListingId, snippet]);

  if (!snippet) return null;

  return (
    <p className="text-sm text-muted-foreground mt-2 line-clamp-4 break-words">
      {stripHtml(snippet, 1500)}
    </p>
  );
}
