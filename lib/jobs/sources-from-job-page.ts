import type { SourceDraft } from "@/components/source-form";
import type { SuggestJobPage } from "@/lib/jobs/suggest-job-page";

/** One ingest source tied to the pasted job URL (no extra aggregator/ATS guesses). */
export function singleSourceFromJobPage(
  page: SuggestJobPage,
  options?: { listingUrl?: string | null },
): SourceDraft[] {
  if (page.kind === "structured") {
    if (page.posting.source === "greenhouse") {
      return [
        {
          kind: "greenhouse_board",
          boardToken: page.posting.boardToken,
        },
      ];
    }
    return [
      {
        kind: "lever_board",
        boardToken: page.posting.boardToken,
      },
    ];
  }

  return [
    {
      kind: "careers_site",
      seedUrl: page.finalUrl,
      listingUrl: options?.listingUrl ?? "",
      seedTitle: page.title,
      seedExcerpt: page.excerpt,
    },
  ];
}
