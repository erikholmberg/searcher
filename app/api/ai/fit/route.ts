import { NextResponse } from "next/server";
import { streamText } from "ai";
import { z } from "zod";
import { auth } from "@/auth";
import { assertAiConfigured, DEFAULT_FAST_MODEL, model } from "@/lib/ai";

export const runtime = "nodejs";

const Body = z.object({
  roleTypeName: z.string().min(1).max(120),
  roleTypeIntent: z.string().max(2000).optional(),
  job: z.object({
    title: z.string().min(1).max(400),
    company: z.string().min(1).max(400),
    snippet: z.string().max(4000).optional(),
    locationDisplay: z.string().max(200).optional(),
    workMode: z.enum(["remote", "hybrid", "onsite", "unknown"]).optional(),
  }),
});

/**
 * Streams a short "why this might fit" paragraph for a given search + job.
 *
 * POST /api/ai/fit
 * body: { roleTypeName, roleTypeIntent?, job: { title, company, snippet?, locationDisplay?, workMode? } }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const { roleTypeName, roleTypeIntent, job } = parsed;
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
      job.snippet ? `Snippet: ${job.snippet}` : "",
      "",
      'Write a short paragraph titled implicitly "why this might fit" for the user.',
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return result.toTextStreamResponse();
}
