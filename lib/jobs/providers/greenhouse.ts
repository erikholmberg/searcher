import type { JobProvider } from "@/lib/jobs/types";
import { inferWorkMode, stripHtml } from "@/lib/jobs/utils";
import type { AtsBoardConfig } from "@/lib/schemas";

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  content?: string;
  location?: { name: string };
  updated_at?: string;
}

interface GreenhouseResp {
  jobs: GreenhouseJob[];
  meta: { total: number };
}

/**
 * Greenhouse returns the full board list each call. We operate in "diff mode":
 * each fetch returns all current jobs and dedupe happens at the RoleTypeJob
 * layer (unique on (roleTypeId, jobListingId)).
 */
export const greenhouseProvider: JobProvider<AtsBoardConfig, never> = {
  kind: "greenhouse_board",

  async fetchPage(config) {
    const token = encodeURIComponent(config.boardToken);
    const url = `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "searcher/0.1" },
    });
    if (!res.ok) {
      throw new Error(`Greenhouse fetch failed (${res.status})`);
    }
    const body = (await res.json()) as GreenhouseResp;

    const filter = config.extraKeywords?.toLowerCase().trim();
    const filtered = filter
      ? body.jobs.filter((j) => j.title.toLowerCase().includes(filter))
      : body.jobs;

    const jobs = filtered.map((j) => {
      const snippet = j.content ? stripHtml(j.content) : null;
      return {
        externalId: `greenhouse:${config.boardToken}:${j.id}`,
        source: `greenhouse:${config.boardToken}`,
        title: j.title,
        company: config.boardToken,
        url: j.absolute_url,
        descriptionSnippet: snippet,
        postedAt: j.updated_at ? new Date(j.updated_at) : null,
        locationDisplay: j.location?.name ?? null,
        workMode: inferWorkMode(
          [j.location?.name, snippet].filter(Boolean).join(" "),
        ),
      };
    });

    return { jobs, nextState: null, exhausted: true };
  },
};
