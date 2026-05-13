import type { JobProvider } from "@/lib/jobs/types";
import { inferWorkMode, parseDate, stripHtml } from "@/lib/jobs/utils";
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
 * Lever returns the full posting list per call. Diff mode like Greenhouse.
 */
export const leverProvider: JobProvider<AtsBoardConfig, never> = {
  kind: "lever_board",

  async fetchPage(config) {
    const site = encodeURIComponent(config.boardToken);
    const url = `https://api.lever.co/v0/postings/${site}?mode=json`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "searcher/0.1" },
    });
    if (!res.ok) throw new Error(`Lever fetch failed (${res.status})`);
    const body = (await res.json()) as LeverJob[];

    const filter = config.extraKeywords?.toLowerCase().trim();
    const filtered = filter
      ? body.filter((j) => j.text?.toLowerCase().includes(filter))
      : body;

    const jobs = filtered.map((j) => {
      const snippet =
        j.descriptionPlain?.slice(0, 800) ??
        (j.description ? stripHtml(j.description) : null);
      const wt = j.workplaceType?.toLowerCase();
      const workMode: WorkMode =
        wt === "remote"
          ? "remote"
          : wt === "hybrid"
            ? "hybrid"
            : wt === "on-site" || wt === "onsite"
              ? "onsite"
              : inferWorkMode(
                  [j.categories?.location, j.categories?.commitment, snippet]
                    .filter(Boolean)
                    .join(" "),
                );
      return {
        externalId: `lever:${config.boardToken}:${j.id}`,
        source: `lever:${config.boardToken}`,
        title: j.text,
        company: config.boardToken,
        url: j.hostedUrl ?? j.applyUrl ?? "",
        descriptionSnippet: snippet,
        postedAt: parseDate(j.createdAt ?? null),
        locationDisplay: j.categories?.location ?? null,
        workMode,
      };
    });

    return { jobs, nextState: null, exhausted: true };
  },
};
