import type { JobProvider } from "@/lib/jobs/types";
import {
  JOB_BOARD_SLICE_SIZE,
  resolveBoardSliceStart,
  type BoardSliceState,
} from "@/lib/jobs/slice-pagination";
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
 * Remotive returns up to `limit` jobs in one response; we slice so find-more
 * can walk through the list in chunks (API has no cursor beyond limit).
 */
export const remotiveProvider: JobProvider<AggregatorQueryConfig, BoardSliceState> = {
  kind: "remotive_query",
  expandRefreshToAllPages: true,

  async fetchPage(config, paginationState) {
    const resolved = resolveBoardSliceStart(paginationState);
    if (resolved.status === "done") {
      return {
        jobs: [],
        nextState: { completed: true },
        exhausted: true,
      };
    }

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

    const slice = body.jobs.slice(
      resolved.offset,
      resolved.offset + JOB_BOARD_SLICE_SIZE,
    );

    const jobs = slice.map((j) => ({
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

    const nextOffset = resolved.offset + slice.length;
    const exhausted = nextOffset >= body.jobs.length;
    const nextState: BoardSliceState = exhausted
      ? { completed: true }
      : { offset: nextOffset };

    return { jobs, nextState, exhausted };
  },
};
