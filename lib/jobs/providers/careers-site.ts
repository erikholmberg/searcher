import type { JobProvider, NormalizedJob } from "@/lib/jobs/types";
import type { CareersSiteConfig } from "@/lib/schemas";
import { fetchHttpsHtmlForSuggest } from "@/lib/jobs/public-page-fetch";
import {
  buildGenericJobExcerpt,
  extractGenericPageSignals,
  inferWorkMode,
} from "@/lib/jobs/html-extract";
import { publicJobExternalId } from "@/lib/jobs/seed-listing";
import {
  extractJobLinksFromHtml,
  resolveCareersListingUrl,
  scoreJobSimilarity,
} from "@/lib/jobs/discover";

const DEFAULT_MAX_JOBS = 15;
const DEFAULT_MIN_SIMILARITY = 0.55;
const MAX_CANDIDATES = 40;
const FETCH_CONCURRENCY = 5;

export type CareersSiteState =
  | { completed: true }
  | {
      skipExternalIds?: string[];
      searchIntent?: string | null;
    }
  | null;

function skipExternalIdsFromState(state: CareersSiteState): string[] {
  if (!state) return [];
  if ("completed" in state) return [];
  return state.skipExternalIds ?? [];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

async function normalizePostingUrl(
  url: string,
  matchScore: number,
): Promise<NormalizedJob | null> {
  try {
    const { finalUrl, html } = await fetchHttpsHtmlForSuggest(url);
    const sig = extractGenericPageSignals(html);
    const excerpt = buildGenericJobExcerpt(html);
    const title = sig.title?.trim() || finalUrl;
    const company =
      sig.siteName?.trim() || new URL(finalUrl).hostname;
    const workMode = inferWorkMode(
      [sig.title, sig.description, excerpt].filter(Boolean).join(" "),
    );
    return {
      externalId: publicJobExternalId(finalUrl),
      source: "public_job",
      title: title.slice(0, 500),
      company: company.slice(0, 200),
      url: finalUrl,
      descriptionSnippet: excerpt.slice(0, 4000) || null,
      postedAt: null,
      locationDisplay: null,
      workMode,
      matchScore,
    };
  } catch {
    return null;
  }
}

export const careersSiteProvider: JobProvider<
  CareersSiteConfig & { searchIntent?: string | null },
  CareersSiteState
> = {
  kind: "careers_site",

  async fetchPage(config, paginationState) {
    if (paginationState && "completed" in paginationState && paginationState.completed) {
      return {
        jobs: [],
        nextState: paginationState,
        exhausted: true,
      };
    }

    const skipIds = new Set(skipExternalIdsFromState(paginationState));
    const maxJobs = config.maxJobs ?? DEFAULT_MAX_JOBS;
    const minSimilarity = config.minSimilarity ?? DEFAULT_MIN_SIMILARITY;
    const searchIntent = config.searchIntent ?? null;

    let seedTitle = config.seedTitle?.trim() ?? "";
    let seedExcerpt = config.seedExcerpt?.trim() ?? "";

    if (!seedTitle || !seedExcerpt) {
      const { finalUrl, html } = await fetchHttpsHtmlForSuggest(config.seedUrl);
      const sig = extractGenericPageSignals(html);
      seedTitle = seedTitle || sig.title?.trim() || finalUrl;
      seedExcerpt = seedExcerpt || buildGenericJobExcerpt(html);
    }

    let listingUrl = config.listingUrl?.trim() || null;
    if (!listingUrl) {
      const resolved = await resolveCareersListingUrl(config.seedUrl);
      if (!resolved) {
        const seedOnly = await normalizePostingUrl(config.seedUrl, 1);
        return {
          jobs: seedOnly && !skipIds.has(seedOnly.externalId) ? [seedOnly] : [],
          nextState: { completed: true },
          exhausted: true,
        };
      }
      listingUrl = resolved.listingUrl;
    }

    const { html: listingHtml } = await fetchHttpsHtmlForSuggest(listingUrl);
    let candidates = extractJobLinksFromHtml(
      listingHtml,
      config.seedUrl,
      MAX_CANDIDATES,
    );

    if (skipIds.size) {
      candidates = candidates.filter(
        (c) => !skipIds.has(publicJobExternalId(c.url)),
      );
    }

    if (!candidates.length) {
      const seedOnly = await normalizePostingUrl(config.seedUrl, 1);
      return {
        jobs: seedOnly && !skipIds.has(seedOnly.externalId) ? [seedOnly] : [],
        nextState: { completed: true },
        exhausted: true,
      };
    }

    const scored = await scoreJobSimilarity(
      { title: seedTitle, excerpt: seedExcerpt },
      searchIntent,
      candidates,
    );

    const winners = scored
      .filter((s) => s.score >= minSimilarity)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxJobs);

    if (!winners.length) {
      const seedOnly = await normalizePostingUrl(config.seedUrl, 1);
      return {
        jobs: seedOnly && !skipIds.has(seedOnly.externalId) ? [seedOnly] : [],
        nextState: { completed: true },
        exhausted: true,
      };
    }

    const jobs = (
      await mapWithConcurrency(winners, FETCH_CONCURRENCY, (w) =>
        normalizePostingUrl(w.url, w.score),
      )
    ).filter((j): j is NormalizedJob => j != null && !skipIds.has(j.externalId));

    const seen = new Set<string>();
    const deduped: NormalizedJob[] = [];
    for (const j of jobs) {
      if (seen.has(j.externalId)) continue;
      seen.add(j.externalId);
      deduped.push(j);
    }

    return {
      jobs: deduped,
      nextState: { completed: true },
      exhausted: true,
    };
  },
};
