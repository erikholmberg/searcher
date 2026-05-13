import type { ResolvedPosting } from "@/lib/jobs/resolve-job-url";
import { resolveJobUrl } from "@/lib/jobs/resolve-job-url";
import {
  buildGenericJobExcerpt,
  extractGenericPageSignals,
  inferWorkMode,
} from "@/lib/jobs/html-extract";
import { fetchHttpsHtmlForSuggest } from "@/lib/jobs/public-page-fetch";
import type { WorkMode } from "@/lib/types";

export type SuggestJobPage =
  | {
      kind: "structured";
      posting: ResolvedPosting;
    }
  | {
      kind: "generic";
      finalUrl: string;
      title: string;
      company: string;
      excerpt: string;
      workMode: WorkMode;
    };

/**
 * Prefer structured ATS resolution; otherwise fetch HTML and derive text for AI.
 */
export async function loadJobPageForSuggest(rawUrl: string): Promise<SuggestJobPage> {
  const structured = await resolveJobUrl(rawUrl);
  if (structured) return { kind: "structured", posting: structured };

  const { finalUrl, html } = await fetchHttpsHtmlForSuggest(rawUrl);
  const sig = extractGenericPageSignals(html);
  const excerpt = buildGenericJobExcerpt(html);
  const title = sig.title?.trim() || finalUrl;
  const company = (sig.siteName?.trim() || "Unknown").slice(0, 200);
  const workMode = inferWorkMode(
    [sig.title, sig.description, excerpt].filter(Boolean).join(" "),
  );

  return {
    kind: "generic",
    finalUrl,
    title,
    company,
    excerpt,
    workMode,
  };
}
