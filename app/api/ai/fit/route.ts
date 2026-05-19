import { NextResponse } from "next/server";
import { streamText } from "ai";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertAiConfigured, DEFAULT_FAST_MODEL, model } from "@/lib/ai";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const Body = z.object({
  roleTypeId: z.string().min(1).max(80),
  jobListingId: z.string().min(1).max(80),
});

/**
 * Streams a short "why this might fit" paragraph for a role type + owned job.
 *
 * POST /api/ai/fit
 * body: { roleTypeId, jobListingId }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const rl = enforceRateLimit(req, {
    scope: "ai-fit",
    userId,
    limit: 60,
    windowMs: 10 * 60_000,
  });
  if (rl) return rl;

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: String(err) },
      { status: 400 },
    );
  }

  try {
    assertAiConfigured();
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 503 },
    );
  }

  const { roleTypeId, jobListingId } = parsed;
  const roleType = await prisma.roleType.findFirst({
    where: { id: roleTypeId, userId },
    select: { id: true, name: true, intent: true },
  });
  if (!roleType) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 });
  }
  const roleTypeJob = await prisma.roleTypeJob.findFirst({
    where: { roleTypeId, jobListingId },
    select: {
      jobListing: {
        select: {
          title: true,
          company: true,
          descriptionSnippet: true,
          locationDisplay: true,
          workMode: true,
        },
      },
    },
  });
  if (!roleTypeJob) {
    return NextResponse.json({ error: "Job not found for this search" }, { status: 404 });
  }

  const job = roleTypeJob.jobListing;
  const roleTypeName = roleType.name;
  const roleTypeIntent = roleType.intent;
  const intentLine = roleTypeIntent
    ? `The user describes that search as: ${roleTypeIntent}`
    : `The user has not described the search beyond its name.`;

  const result = streamText({
    model: model(DEFAULT_FAST_MODEL),
    system:
      "You write concise, honest job-fit summaries. Be specific and avoid embellishment. Output 2-4 short sentences max. Never invent details about the employer that aren't supported by the snippet.",
    prompt: [
      `Search: ${roleTypeName}`,
      intentLine,
      "",
      `Job: ${job.title} at ${job.company}`,
      job.locationDisplay ? `Location: ${job.locationDisplay}` : "",
      job.workMode ? `Work mode: ${job.workMode}` : "",
      job.descriptionSnippet ? `Snippet: ${job.descriptionSnippet}` : "",
      "",
      'Write a short paragraph titled implicitly "why this might fit" for the user.',
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return result.toTextStreamResponse();
}
