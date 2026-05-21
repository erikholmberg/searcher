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
import { inferWorkMode, parseDate } from "@/lib/jobs/utils";
import type { AtsBoardConfig } from "@/lib/schemas";
import type { WorkMode } from "@/lib/types";

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  descriptionPlain?: string;
  description?: string;
  categories?: { location?: string; team?: string; commitment?: string };
  workplaceType?: string;
  createdAt?: number;
}

/**
 * Lever returns the full posting list per HTTP call; we slice like Greenhouse.
 */
export const leverProvider: JobProvider<AtsBoardConfig, BoardSliceState> = {
  kind: "lever_board",
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
    const cacheKey = boardFetchCacheKey("lever", config.boardToken, filter);
    let body = getBoardFetchCache<LeverJob[]>(cacheKey);
    if (!body) {
      const site = encodeURIComponent(config.boardToken);
      const url = `https://api.lever.co/v0/postings/${site}?mode=json`;
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "searcher/0.1" },
      });
      if (!res.ok) throw new Error(`Lever fetch failed (${res.status})`);
      body = (await res.json()) as LeverJob[];
      setBoardFetchCache(cacheKey, body);
    }

    const filtered = filter
      ? body.filter((j) => j.text?.toLowerCase().includes(filter))
      : body;

    const slice = filtered.slice(
      resolved.offset,
      resolved.offset + JOB_BOARD_SLICE_SIZE,
    );

    const jobs = slice.map((j) => {
      const wt = j.workplaceType?.toLowerCase();
      const workMode: WorkMode =
        wt === "remote"
          ? "remote"
          : wt === "hybrid"
            ? "hybrid"
            : wt === "on-site" || wt === "onsite"
              ? "onsite"
              : inferWorkMode(
                  [j.categories?.location, j.categories?.commitment]
                    .filter(Boolean)
                    .join(" "),
                );
      return {
        externalId: `lever:${config.boardToken}:${j.id}`,
        source: `lever:${config.boardToken}`,
        title: j.text,
        company: config.boardToken,
        url: j.hostedUrl ?? j.applyUrl ?? "",
        descriptionSnippet: null,
        postedAt: parseDate(j.createdAt ?? null),
        locationDisplay: j.categories?.location ?? null,
        workMode,
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
