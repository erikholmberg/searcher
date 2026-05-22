"use client";

import * as React from "react";
import { stripHtml } from "@/lib/jobs/utils";

type Props = {
  initialSnippet: string | null;
};

export function JobDescriptionSnippet({ initialSnippet }: Props) {
  const text = React.useMemo(
    () => (initialSnippet ? stripHtml(initialSnippet, 1500) : null),
    [initialSnippet],
  );
  if (!text) return null;

  return (
    <p className="text-sm text-muted-foreground mt-2 line-clamp-4 break-words">
      {text}
    </p>
  );
}
