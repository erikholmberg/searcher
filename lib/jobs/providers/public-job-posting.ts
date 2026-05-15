import { createHash } from "node:crypto";
import type { JobProvider } from "@/lib/jobs/types";
import {
  buildGenericJobExcerpt,
  extractGenericPageSignals,
  inferWorkMode,
} from "@/lib/jobs/html-extract";
import { fetchHttpsHtmlForSuggest } from "@/lib/jobs/public-page-fetch";
import type { PublicJobPostingConfig } from "@/lib/schemas";

type PageState = { completed: true } | null;

/**
 * One posting per source: re-fetch the configured https URL and map HTML into
 * a single normalized job (same extraction path as suggest-from-job-url).
 * "Find more" does not add rows; refresh updates the snapshot.
 */
export const publicJobPostingProvider: JobProvider<
  PublicJobPostingConfig,
  PageState
> = {
  kind: "public_job_posting",

  async fetchPage(config, paginationState) {
    if (paginationState?.completed) {
      return {
        jobs: [],
        nextState: paginationState,
        exhausted: true,
      };
    }

    const { finalUrl, html } = await fetchHttpsHtmlForSuggest(config.url);
    const sig = extractGenericPageSignals(html);
    const excerpt = buildGenericJobExcerpt(html);
    const title = sig.title?.trim() || finalUrl;
    const company =
      sig.siteName?.trim() || new URL(finalUrl).hostname;
    const workMode = inferWorkMode(
      [sig.title, sig.description, excerpt].filter(Boolean).join(" "),
    );
    const snippet = excerpt.slice(0, 4000);
    const idHash = createHash("sha256")
      .update(finalUrl)
      .digest("hex")
      .slice(0, 40);

    return {
      jobs: [
        {
          externalId: `public_job:${idHash}`,
          source: "public_job",
          title: title.slice(0, 500),
          company: company.slice(0, 200),
          url: finalUrl,
          descriptionSnippet: snippet || null,
          postedAt: null,
          locationDisplay: null,
          workMode,
        },
      ],
      nextState: { completed: true },
      exhausted: true,
    };
  },
};
