import type { JobProvider } from "@/lib/jobs/types";
import { parseDate, stripHtml } from "@/lib/jobs/utils";
import type { AggregatorQueryConfig } from "@/lib/schemas";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  description: string;
}

interface RemotiveResp {
  jobs: RemotiveJob[];
  "job-count": number;
}

/**
 * Remotive returns a full match list with optional query/category/limit. There
 * is no page cursor, so this provider is "diff mode": each fetch returns the
 * whole result list and dedupe happens at the RoleTypeJob layer.
 */
export const remotiveProvider: JobProvider<AggregatorQueryConfig, never> = {
  kind: "remotive_query",

  async fetchPage(config) {
    const url = new URL("https://remotive.com/api/remote-jobs");
    if (config.keywords) url.searchParams.set("search", config.keywords);
    url.searchParams.set(
      "limit",
      String(Math.min(config.maxResults ?? 50, 100)),
    );

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "searcher/0.1" },
    });
    if (!res.ok) throw new Error(`Remotive fetch failed (${res.status})`);
    const body = (await res.json()) as RemotiveResp;

    const jobs = body.jobs.map((j) => ({
      externalId: `remotive:${j.id}`,
      source: "remotive",
      title: j.title,
      company: j.company_name,
      url: j.url,
      descriptionSnippet: stripHtml(j.description ?? ""),
      postedAt: parseDate(j.publication_date),
      locationDisplay: j.candidate_required_location || null,
      workMode: "remote" as const,
    }));

    return { jobs, nextState: null, exhausted: true };
  },
};
