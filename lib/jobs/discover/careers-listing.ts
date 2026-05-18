/**
 * Resolve the careers listing (index) URL from a seed job posting URL.
 */
import { generateObject } from "ai";
import { z } from "zod";
import { assertAiConfigured, DEFAULT_FAST_MODEL, model } from "@/lib/ai";
import { fetchHttpsHtmlForSuggest } from "@/lib/jobs/public-page-fetch";
import { countJobLikeLinks } from "@/lib/jobs/discover/extract-job-links";

const MAX_LISTING_CANDIDATES = 4;

const COMMON_PATHS = [
  "/careers",
  "/jobs",
  "/open-positions",
  "/openings",
  "/join-us",
  "/work-with-us",
];

const ListingUrlSchema = z.object({
  listingUrl: z
    .string()
    .url()
    .describe("https URL of the page listing all open roles at this employer"),
});

function parentPathCandidates(seedUrl: string): string[] {
  const u = new URL(seedUrl);
  const parts = u.pathname.split("/").filter(Boolean);
  const urls: string[] = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    const path = "/" + parts.slice(0, i).join("/");
    urls.push(new URL(path || "/", u.origin).href);
  }
  urls.push(new URL("/", u.origin).href);
  return urls;
}

function listingCandidateUrls(seedUrl: string): string[] {
  const u = new URL(seedUrl);
  const set = new Set<string>();
  for (const p of parentPathCandidates(seedUrl)) set.add(p);
  for (const p of COMMON_PATHS) {
    set.add(new URL(p, u.origin).href);
  }
  set.delete(seedUrl.replace(/\/$/, "") || seedUrl);
  return [...set].slice(0, 12);
}

async function scoreListingCandidate(
  url: string,
  seedUrl: string,
): Promise<{ url: string; count: number } | null> {
  try {
    const { finalUrl, html } = await fetchHttpsHtmlForSuggest(url);
    const origin = new URL(seedUrl).origin;
    if (new URL(finalUrl).origin !== origin) return null;
    const count = countJobLikeLinks(html, seedUrl);
    return { url: finalUrl, count };
  } catch {
    return null;
  }
}

async function resolveListingWithHeuristics(
  seedUrl: string,
  seedHtml?: string,
): Promise<{ listingUrl: string; candidateCount: number } | null> {
  const candidates = listingCandidateUrls(seedUrl).slice(0, MAX_LISTING_CANDIDATES + 2);
  const scored: Array<{ url: string; count: number }> = [];

  if (seedHtml) {
    const onSeed = countJobLikeLinks(seedHtml, seedUrl);
    if (onSeed >= 3) {
      scored.push({ url: seedUrl, count: onSeed });
    }
  }

  let fetches = 0;
  for (const c of candidates) {
    if (fetches >= MAX_LISTING_CANDIDATES) break;
    if (scored.some((s) => s.url === c)) continue;
    const result = await scoreListingCandidate(c, seedUrl);
    fetches += 1;
    if (result && result.count > 0) scored.push(result);
  }

  if (!scored.length) return null;
  scored.sort((a, b) => b.count - a.count);
  const best = scored[0];
  return { listingUrl: best.url, candidateCount: best.count };
}

async function resolveListingWithAi(
  seedUrl: string,
  seedHtml: string,
): Promise<string | null> {
  assertAiConfigured();
  const links: string[] = [];
  const anchorRe =
    /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(seedHtml)) !== null && links.length < 80) {
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    links.push(`${m[1].trim()} | ${text.slice(0, 80)}`);
  }

  const result = await generateObject({
    model: model(DEFAULT_FAST_MODEL),
    schema: ListingUrlSchema,
    system:
      "Pick the careers/jobs listing page on the SAME site as the seed job. Must be https and same host as the seed. If unsure, prefer /careers or /jobs index pages.",
    prompt: [
      `Seed job URL: ${seedUrl}`,
      "",
      "Links from the seed page (href | anchor text):",
      links.slice(0, 60).join("\n") || "(none parsed)",
    ].join("\n"),
  });

  try {
    const u = new URL(result.object.listingUrl);
    const seed = new URL(seedUrl);
    if (u.protocol !== "https:" || u.origin !== seed.origin) return null;
    return u.href;
  } catch {
    return null;
  }
}

export interface ListingResolution {
  listingUrl: string;
  candidateCount: number;
}

/**
 * Find the best careers listing URL for a seed job posting.
 */
export async function resolveCareersListingUrl(
  seedUrl: string,
  options?: { seedHtml?: string },
): Promise<ListingResolution | null> {
  const heuristic = await resolveListingWithHeuristics(
    seedUrl,
    options?.seedHtml,
  );
  if (heuristic && heuristic.candidateCount >= 2) {
    return heuristic;
  }

  let html = options?.seedHtml;
  if (!html) {
    try {
      const fetched = await fetchHttpsHtmlForSuggest(seedUrl);
      html = fetched.html;
    } catch {
      return heuristic;
    }
  }

  try {
    const aiUrl = await resolveListingWithAi(seedUrl, html);
    if (aiUrl) {
      try {
        const { html: listingHtml } = await fetchHttpsHtmlForSuggest(aiUrl);
        const candidateCount = countJobLikeLinks(listingHtml, seedUrl);
        if (candidateCount >= 1) {
          return { listingUrl: aiUrl, candidateCount };
        }
      } catch {
        return { listingUrl: aiUrl, candidateCount: 0 };
      }
    }
  } catch {
    // AI optional when gateway unavailable during listing-only probe
  }

  return heuristic;
}
