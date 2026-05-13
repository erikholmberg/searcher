import type { JobProvider } from "@/lib/jobs/types";
import {
  parseAggregatorPageState,
  type AggregatorPageState,
} from "@/lib/jobs/slice-pagination";
import { inferWorkMode, parseDate, stripHtml } from "@/lib/jobs/utils";
import type { AggregatorQueryConfig } from "@/lib/schemas";

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number; // unix
}

interface ArbeitnowResp {
  data: ArbeitnowJob[];
  links: { next: string | null };
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export const arbeitnowProvider: JobProvider<
  AggregatorQueryConfig,
  AggregatorPageState
> = {
  kind: "arbeitnow_query",

  async fetchPage(config, paginationState) {
    const nav = parseAggregatorPageState(paginationState);
    if (!("page" in nav)) {
      return {
        jobs: [],
        nextState: { completed: true },
        exhausted: true,
      };
    }
    const page = nav.page;
    const url = new URL("https://www.arbeitnow.com/api/job-board-api");
    url.searchParams.set("page", String(page));

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "searcher/0.1" },
    });
    if (!res.ok) {
      throw new Error(`Arbeitnow fetch failed (${res.status})`);
    }
    const body = (await res.json()) as ArbeitnowResp;

    const keywords = config.keywords?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
    const filtered = body.data.filter((j) => {
      const haystack = `${j.title} ${j.tags?.join(" ") ?? ""}`.toLowerCase();
      const matchesKeywords =
        keywords.length === 0 || keywords.every((k) => haystack.includes(k));
      if (!matchesKeywords) return false;
      if (config.remoteOnly && !j.remote) return false;
      if (config.location) {
        const loc = config.location.toLowerCase();
        if (
          !j.location?.toLowerCase().includes(loc) &&
          !(loc === "remote" && j.remote)
        )
          return false;
      }
      return true;
    });

    const jobs = filtered.map((j) => ({
      externalId: `arbeitnow:${j.slug}`,
      source: "arbeitnow",
      title: j.title,
      company: j.company_name,
      url: j.url,
      descriptionSnippet: stripHtml(j.description ?? ""),
      postedAt: parseDate(j.created_at * 1000),
      locationDisplay: j.location || null,
      workMode: j.remote ? ("remote" as const) : inferWorkMode(j.location),
    }));

    const exhausted = body.meta.current_page >= body.meta.last_page;
    return {
      jobs,
      nextState: exhausted ? { completed: true } : { page: page + 1 },
      exhausted,
    };
  },
};
