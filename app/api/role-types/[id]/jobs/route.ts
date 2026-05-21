import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { notFound, unauthorized } from "@/lib/http";
import { listJobsForRoleType } from "@/lib/role-types-data";

export const runtime = "nodejs";

/**
 * GET /api/role-types/:id/jobs
 * Jobs for one search (no description snippets unless ?snippets=1).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const url = new URL(_req.url);
  const includeSnippet = url.searchParams.get("snippets") === "1";

  const jobs = await listJobsForRoleType(session.user.id, id, {
    includeSnippet,
  });
  if (jobs === null) return notFound("Search");

  return NextResponse.json({ jobs });
}
