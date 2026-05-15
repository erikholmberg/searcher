import type { SourceDraft } from "@/components/source-form";
import type { SuggestJobPage } from "@/lib/jobs/suggest-job-page";

/** One ingest source tied to the pasted job URL (no extra aggregator/ATS guesses). */
export function singleSourceFromJobPage(page: SuggestJobPage): SourceDraft[] {
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
      kind: "public_job_posting",
      postingUrl: page.finalUrl,
    },
  ];
}
