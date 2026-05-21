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
import { inferWorkMode } from "@/lib/jobs/utils";
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
 * Greenhouse returns the full board list each HTTP call. We slice it into
 * windows so "find more" can append the next chunk; dedupe stays at RoleTypeJob.
 */
export const greenhouseProvider: JobProvider<AtsBoardConfig, BoardSliceState> = {
  kind: "greenhouse_board",
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
    const cacheKey = boardFetchCacheKey(
      "greenhouse",
      config.boardToken,
      filter,
    );
    let body = getBoardFetchCache<GreenhouseResp>(cacheKey);
    if (!body) {
      const token = encodeURIComponent(config.boardToken);
      const url = `https://boards-api.greenhouse.io/v1/boards/${token}/jobs`;
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "searcher/0.1" },
      });
      if (!res.ok) {
        throw new Error(`Greenhouse fetch failed (${res.status})`);
      }
      body = (await res.json()) as GreenhouseResp;
      setBoardFetchCache(cacheKey, body);
    }

    const filtered = filter
      ? body.jobs.filter((j) => j.title.toLowerCase().includes(filter))
      : body.jobs;

    const slice = filtered.slice(
      resolved.offset,
      resolved.offset + JOB_BOARD_SLICE_SIZE,
    );

    const jobs = slice.map((j) => {
      return {
        externalId: `greenhouse:${config.boardToken}:${j.id}`,
        source: `greenhouse:${config.boardToken}`,
        title: j.title,
        company: config.boardToken,
        url: j.absolute_url,
        descriptionSnippet: null,
        postedAt: j.updated_at ? new Date(j.updated_at) : null,
        locationDisplay: j.location?.name ?? null,
        workMode: inferWorkMode(j.location?.name ?? ""),
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
