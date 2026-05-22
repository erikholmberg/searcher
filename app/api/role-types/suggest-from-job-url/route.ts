import { NextResponse } from "next/server";
import { z } from "zod";
import { generateObject } from "ai";
import { auth } from "@/auth";
import { jsonError, unauthorized, zodError } from "@/lib/http";
import { SuggestFromUrlBody } from "@/lib/schemas";
import { loadJobPageForSuggest } from "@/lib/jobs/suggest-job-page";
import { singleSourceFromJobPage } from "@/lib/jobs/sources-from-job-page";
import {
  seedListingFromGeneric,
  seedListingFromStructured,
} from "@/lib/jobs/seed-listing";
import { assertAiConfigured, DEFAULT_FAST_MODEL, model } from "@/lib/ai";
import { resolveCareersListingUrl } from "@/lib/jobs/discover";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ProposalSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .describe(
      "Short label for the search (e.g. 'Staff backend', 'ML platform engineer').",
    ),
  intent: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "1-2 sentence description of what 'similar' means for this search: seniority, stack, domain, work style.",
    ),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return unauthorized();
  const rl = enforceRateLimit(req, {
    scope: "suggest-from-job-url",
    userId: session.user.id,
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (rl) return rl;

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
    console.error("[suggest-from-job-url] page load failed", {
      url: parsed.data.url,
      error: err,
    });
    return jsonError(`Failed to read page: ${(err as Error).message}`, 502);
  }

  try {
    assertAiConfigured();
  } catch (err) {
    return jsonError((err as Error).message, 503);
  }

  const postingContext =
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
        ].join("\n");

  const prompt = [
    postingContext,
    "",
    "Propose only:",
    "- A short name for the search.",
    "- A 1-2 sentence intent describing what 'similar' means.",
    "",
    page.kind === "generic"
      ? "Do not propose search sources—the app will search this employer's careers site for similar roles."
      : "Do not propose search sources or keywords—the app will attach a board source from this URL.",
  ].join("\n");

  let aiResult;
  try {
    aiResult = await generateObject({
      model: model(DEFAULT_FAST_MODEL),
      schema: ProposalSchema,
      system:
        "You suggest a saved job search so the user can find SIMILAR roles to the posting described. Focus on name and intent only; do not invent employers, locations, or board identifiers.",
      prompt,
    });
  } catch (err) {
    console.error("[suggest-from-job-url] AI proposal failed", {
      url: parsed.data.url,
      pageKind: page.kind,
      error: err,
    });
    return jsonError(
      `AI proposal failed: ${(err as Error).message}`,
      502,
    );
  }

  let discovery: { listingUrl: string; candidateCount: number } | null = null;
  if (page.kind === "generic") {
    try {
      discovery = await resolveCareersListingUrl(page.finalUrl);
    } catch {
      discovery = null;
    }
  }

  const sources = singleSourceFromJobPage(page, {
    listingUrl: discovery?.listingUrl ?? null,
  });

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
    discovery,
    proposal: {
      name: aiResult.object.name,
      intent: aiResult.object.intent,
      sources,
    },
  });
}
