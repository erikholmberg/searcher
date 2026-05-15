import { NextResponse } from "next/server";
import { z } from "zod";
import { generateObject } from "ai";
import { auth } from "@/auth";
import { jsonError, unauthorized, zodError } from "@/lib/http";
import { SuggestFromUrlBody } from "@/lib/schemas";
import { loadJobPageForSuggest } from "@/lib/jobs/suggest-job-page";
import {
  seedListingFromGeneric,
  seedListingFromStructured,
} from "@/lib/jobs/seed-listing";
import { assertAiConfigured, DEFAULT_FAST_MODEL, model } from "@/lib/ai";
import type { SourceDraft } from "@/components/source-form";

export const runtime = "nodejs";

/**
 * Flat source shape for `generateObject` JSON schema. OpenAI structured output
 * rejects `oneOf` on array items (Zod discriminated unions). It also requires
 * `required` to list every key in `properties`—no optional keys—so every field
 * is required; use empty string / false when a field does not apply to `kind`.
 */
const ProposalSourceLaxSchema = z.object({
  kind: z
    .enum([
      "arbeitnow_query",
      "remotive_query",
      "greenhouse_board",
      "lever_board",
    ])
    .describe("Source type for this bucket."),
  keywords: z
    .string()
    .max(120)
    .describe(
      "For arbeitnow_query and remotive_query: non-empty search keywords. For ATS kinds: use empty string \"\".",
    ),
  location: z
    .string()
    .max(80)
    .describe(
      "For arbeitnow_query only: location filter, or empty string \"\" if none.",
    ),
  remoteOnly: z
    .boolean()
    .describe(
      "For arbeitnow_query only: true to prefer remote-only listings. For all other kinds: false.",
    ),
  boardToken: z
    .string()
    .max(80)
    .describe(
      "For greenhouse_board and lever_board: non-empty board/site token. For aggregators: empty string \"\".",
    ),
  extraKeywords: z
    .string()
    .max(120)
    .describe(
      "For greenhouse_board and lever_board only: extra title filter, or empty string \"\".",
    ),
});

const ProposalSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .describe(
      "Short label for the role-type bucket (e.g. 'Staff backend', 'ML platform engineer').",
    ),
  intent: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "1-2 sentence description of what 'similar' means for this bucket: seniority, stack, domain, work style.",
    ),
  sources: z.array(ProposalSourceLaxSchema).min(1).max(4),
});

function proposalSourceToDraft(raw: z.infer<typeof ProposalSourceLaxSchema>): SourceDraft {
  const kw = raw.keywords.trim();
  const token = raw.boardToken.trim();
  const loc = raw.location.trim();
  const extra = raw.extraKeywords.trim();

  switch (raw.kind) {
    case "arbeitnow_query":
      if (!kw) throw new Error("arbeitnow_query requires non-empty keywords");
      return {
        kind: "arbeitnow_query",
        keywords: kw,
        location: loc || undefined,
        remoteOnly: raw.remoteOnly ? true : undefined,
      };
    case "remotive_query":
      if (!kw) throw new Error("remotive_query requires non-empty keywords");
      return { kind: "remotive_query", keywords: kw };
    case "greenhouse_board":
      if (!token) throw new Error("greenhouse_board requires boardToken");
      return {
        kind: "greenhouse_board",
        boardToken: token,
        extraKeywords: extra || undefined,
      };
    case "lever_board":
      if (!token) throw new Error("lever_board requires boardToken");
      return {
        kind: "lever_board",
        boardToken: token,
        extraKeywords: extra || undefined,
      };
    default:
      throw new Error(`Unknown source kind: ${String((raw as { kind: string }).kind)}`);
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Body must be JSON", 400);
  }
  const parsed = SuggestFromUrlBody.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  let page;
  try {
    page = await loadJobPageForSuggest(parsed.data.url);
  } catch (err) {
    return jsonError(`Failed to read page: ${(err as Error).message}`, 502);
  }

  try {
    assertAiConfigured();
  } catch (err) {
    return jsonError((err as Error).message, 503);
  }

  const sourceHint =
    page.kind === "structured"
      ? page.posting.source === "greenhouse"
        ? `The posting is hosted on Greenhouse for board "${page.posting.boardToken}". A "greenhouse_board" source for this token is a sensible starting point.`
        : `The posting is hosted on Lever for site "${page.posting.boardToken}". A "lever_board" source for this site is a sensible starting point.`
      : `This URL was read as generic HTML (not a known jobs API). Prefer arbeitnow_query and remotive_query sources grounded in the excerpt. Only propose greenhouse_board or lever_board if the excerpt or URL clearly names a verifiable board (e.g. a boards.greenhouse.io/TOKEN path or jobs.lever.co/SITE/...). Never invent board tokens.`;

  const system =
    page.kind === "structured"
      ? "You suggest a role-type bucket so the user can find SIMILAR roles. Only propose ATS board sources for boards explicitly named in the input; do not invent boards. Keep keyword strings short and high-signal."
      : "You suggest a role-type bucket so the user can find SIMILAR roles. The input is plain text extracted from a public web page—it may contain navigation noise; focus on the job description. Do not invent employers, locations, or ATS board identifiers. Keep keyword strings short and high-signal.";

  const prompt =
    page.kind === "structured"
      ? [
          "Posting summary (do not invent details):",
          `Title: ${page.posting.title}`,
          `Company: ${page.posting.company}`,
          page.posting.locationDisplay
            ? `Location: ${page.posting.locationDisplay}`
            : "",
          `Work mode: ${page.posting.workMode}`,
          page.posting.snippet ? `Snippet: ${page.posting.snippet}` : "",
          "",
          sourceHint,
          "",
          "Propose:",
          "- A short name for the role type bucket.",
          "- A 1-2 sentence intent describing what 'similar' means.",
          "- 1-4 sources to populate this bucket. Include at minimum one aggregator query and (when applicable) the inferred ATS board.",
          "",
          "Each source object must include every field: kind, keywords, location, remoteOnly, boardToken, extraKeywords. Use empty string \"\" and false for fields that do not apply to that source's kind.",
        ]
          .filter(Boolean)
          .join("\n")
      : [
          "The user pasted a public job posting page. The text below was extracted from HTML (tags removed; boilerplate may remain).",
          "",
          `Canonical URL: ${page.finalUrl}`,
          `Page title: ${page.title}`,
          `Employer / site hint: ${page.company}`,
          `Inferred work mode from text: ${page.workMode}`,
          "",
          "Extracted page text:",
          page.excerpt,
          "",
          sourceHint,
          "",
          "Propose:",
          "- A short name for the role type bucket.",
          "- A 1-2 sentence intent describing what 'similar' means.",
          "- 1-4 sources. Include at least one aggregator query; add ATS board sources only when clearly justified above.",
          "",
          "Each source object must include every field: kind, keywords, location, remoteOnly, boardToken, extraKeywords. Use empty string \"\" and false for fields that do not apply to that source's kind.",
        ].join("\n");

  let aiResult;
  try {
    aiResult = await generateObject({
      model: model(DEFAULT_FAST_MODEL),
      schema: ProposalSchema,
      system,
      prompt,
    });
  } catch (err) {
    return jsonError(
      `AI proposal failed: ${(err as Error).message}`,
      502,
    );
  }

  let sources: SourceDraft[];
  try {
    sources = aiResult.object.sources.map((s) => proposalSourceToDraft(s));
  } catch (normErr) {
    return jsonError(
      `AI proposal failed: invalid source fields (${(normErr as Error).message}). Try again.`,
      502,
    );
  }

  if (page.kind === "generic") {
    const postingUrl = page.finalUrl;
    const already = sources.some(
      (s) =>
        s.kind === "public_job_posting" &&
        (s.postingUrl ?? "").trim() === postingUrl,
    );
    if (!already) {
      sources = [{ kind: "public_job_posting", postingUrl }, ...sources];
    }
  }

  const seedListing =
    page.kind === "structured"
      ? seedListingFromStructured(page.posting)
      : seedListingFromGeneric({
          title: page.title,
          company: page.company,
          url: page.finalUrl,
          snippet: page.excerpt.slice(0, 4000) || null,
          locationDisplay: null,
          workMode: page.workMode,
        });

  const postingDto = {
    title: seedListing.title,
    company: seedListing.company,
    url: seedListing.url,
    snippet: seedListing.descriptionSnippet,
    locationDisplay: seedListing.locationDisplay,
    workMode: seedListing.workMode,
  };

  return NextResponse.json({
    posting: postingDto,
    seedListing,
    proposal: {
      name: aiResult.object.name,
      intent: aiResult.object.intent,
      sources,
    },
  });
}
