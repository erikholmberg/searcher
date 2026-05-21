import type { JobProvider } from "@/lib/jobs/types";
import {
  boardFetchCacheKey,
  getBoardFetchCache,
  setBoardFetchCache,
} from "@/lib/jobs/board-fetch-cache";
import {
  JOB_BOARD_SLICE_SIZE,
  resolveBoardSliceStart,
  type BoardSliceState,
} from "@/lib/jobs/slice-pagination";
import { inferWorkMode, stripHtml } from "@/lib/jobs/utils";
import type { AtsBoardConfig } from "@/lib/schemas";
import type { WorkMode } from "@/lib/types";

interface AshbyJob {
  id?: string;
  jobId?: string;
  title: string;
  location?: string;
  isListed?: boolean;
  isRemote?: boolean;
  workplaceType?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  publishedAt?: string;
  jobUrl: string;
  applyUrl?: string;
  department?: string;
  team?: string;
}

interface AshbyResp {
  jobs: AshbyJob[];
}

function ashbyWorkMode(job: AshbyJob): WorkMode {
  const wt = job.workplaceType?.toLowerCase();
  if (wt === "remote") return "remote";
  if (wt === "hybrid") return "hybrid";
  if (wt === "onsite") return "onsite";
  if (job.isRemote) return "remote";
  const snippet =
    job.descriptionPlain ??
    (job.descriptionHtml ? stripHtml(job.descriptionHtml) : null);
  return inferWorkMode(
    [job.location, job.department, job.team, snippet].filter(Boolean).join(" "),
  );
}

function ashbyJobId(job: AshbyJob): string {
  const raw = job.id ?? job.jobId;
  if (raw) return String(raw);
  try {
    const path = new URL(job.jobUrl).pathname;
    const slug = path.split("/").filter(Boolean).pop();
    if (slug) return slug;
  } catch {
    /* ignore */
  }
  return job.jobUrl;
}

/**
 * Ashby returns the full board list per HTTP call; we slice like Greenhouse/Lever.
 * @see https://developers.ashbyhq.com/docs/public-job-posting-api
 */
export const ashbyProvider: JobProvider<AtsBoardConfig, BoardSliceState> = {
  kind: "ashby_board",
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

    const filter = config.extraKeywords?.toLowerCase().trim();
    const cacheKey = boardFetchCacheKey("ashby", config.boardToken, filter);
    let body = getBoardFetchCache<AshbyResp>(cacheKey);
    if (!body) {
      const board = encodeURIComponent(config.boardToken);
      const url = `https://api.ashbyhq.com/posting-api/job-board/${board}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "searcher/0.1" },
      });
      if (!res.ok) {
        throw new Error(`Ashby fetch failed (${res.status})`);
      }
      body = (await res.json()) as AshbyResp;
      setBoardFetchCache(cacheKey, body);
    }
    const listed = body.jobs.filter((j) => j.isListed !== false && j.title && j.jobUrl);

    const filtered = filter
      ? listed.filter((j) => j.title.toLowerCase().includes(filter))
      : listed;

    const slice = filtered.slice(
      resolved.offset,
      resolved.offset + JOB_BOARD_SLICE_SIZE,
    );

    const jobs = slice.map((j) => {
      const id = ashbyJobId(j);
      return {
        externalId: `ashby:${config.boardToken}:${id}`,
        source: `ashby:${config.boardToken}`,
        title: j.title,
        company: config.boardToken,
        url: j.jobUrl,
        descriptionSnippet: null,
        postedAt: j.publishedAt ? new Date(j.publishedAt) : null,
        locationDisplay: j.location ?? null,
        workMode: ashbyWorkMode(j),
      };
    });

    const nextOffset = resolved.offset + slice.length;
    const exhausted = nextOffset >= filtered.length;
    const nextState: BoardSliceState = exhausted
      ? { completed: true }
      : { offset: nextOffset };

    return { jobs, nextState, exhausted };
  },
};
