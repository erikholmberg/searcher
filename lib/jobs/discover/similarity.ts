/**
 * AI batch scoring: how similar each candidate posting is to the seed role.
 */
import { generateObject } from "ai";
import { z } from "zod";
import { assertAiConfigured, DEFAULT_FAST_MODEL, model } from "@/lib/ai";
import type { JobLinkCandidate } from "@/lib/jobs/discover/extract-job-links";

const ScoreSchema = z.object({
  scores: z.array(
    z.object({
      url: z.string().url(),
      score: z
        .number()
        .min(0)
        .max(1)
        .describe("0 = unrelated, 1 = very similar to the seed role"),
    }),
  ),
});

export interface ScoredCandidate {
  url: string;
  titleHint: string | null;
  score: number;
}

export async function scoreJobSimilarity(
  seed: { title: string; excerpt: string },
  intent: string | null | undefined,
  candidates: JobLinkCandidate[],
): Promise<ScoredCandidate[]> {
  if (!candidates.length) return [];
  assertAiConfigured();

  const intentLine = intent?.trim()
    ? `Search intent: ${intent.trim()}`
    : "No extra intent beyond matching the seed role.";

  const list = candidates
    .map(
      (c, i) =>
        `${i + 1}. ${c.url}${c.titleHint ? ` — "${c.titleHint}"` : ""}`,
    )
    .join("\n");

  const result = await generateObject({
    model: model(DEFAULT_FAST_MODEL),
    schema: ScoreSchema,
    system:
      "Score how similar each job posting URL is to the seed role and intent. Down-rank different departments, seniority levels, or unrelated functions. Return a score for every URL listed.",
    prompt: [
      `Seed role title: ${seed.title}`,
      `Seed excerpt: ${seed.excerpt.slice(0, 3000)}`,
      intentLine,
      "",
      "Candidate postings:",
      list,
    ].join("\n"),
  });

  const byUrl = new Map(
    result.object.scores.map((s) => [s.url.replace(/\/$/, "") || s.url, s.score]),
  );

  return candidates.map((c) => {
    const norm = c.url.replace(/\/$/, "") || c.url;
    const score = byUrl.get(norm) ?? byUrl.get(c.url) ?? 0;
    return { ...c, score };
  });
}
