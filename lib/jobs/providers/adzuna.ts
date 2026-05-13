import type { JobProvider } from "@/lib/jobs/types";
import { inferWorkMode, parseDate, stripHtml } from "@/lib/jobs/utils";
import type { AggregatorQueryConfig } from "@/lib/schemas";

interface AdzunaJob {
  id: string;
  title: string;
  company: { display_name: string };
  redirect_url: string;
  description: string;
  created: string;
  location?: { display_name?: string };
}

interface AdzunaResp {
  results: AdzunaJob[];
  count: number;
}

interface State {
  page: number;
}

export const adzunaProvider: JobProvider<AggregatorQueryConfig, State> = {
  kind: "adzuna_query",

  async fetchPage(config, paginationState) {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) {
      throw new Error(
        "Adzuna provider requires ADZUNA_APP_ID and ADZUNA_APP_KEY env vars.",
      );
    }
    const country = (config.country ?? "us").toLowerCase();
    const page = paginationState?.page ?? 1;
    const url = new URL(
      `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`,
    );
    url.searchParams.set("app_id", appId);
    url.searchParams.set("app_key", appKey);
    url.searchParams.set("results_per_page", String(Math.min(config.maxResults ?? 25, 50)));
    if (config.keywords) url.searchParams.set("what", config.keywords);
    if (config.location) url.searchParams.set("where", config.location);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "searcher/0.1" },
    });
    if (!res.ok) throw new Error(`Adzuna fetch failed (${res.status})`);
    const body = (await res.json()) as AdzunaResp;

    const jobs = body.results.map((j) => ({
      externalId: `adzuna:${j.id}`,
      source: "adzuna",
      title: j.title,
      company: j.company.display_name,
      url: j.redirect_url,
      descriptionSnippet: stripHtml(j.description ?? ""),
      postedAt: parseDate(j.created),
      locationDisplay: j.location?.display_name ?? null,
      workMode: inferWorkMode(j.description),
    }));

    const exhausted = jobs.length === 0;
    return {
      jobs,
      nextState: exhausted ? null : { page: page + 1 },
      exhausted,
    };
  },
};
