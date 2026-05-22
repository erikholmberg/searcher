import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { notFound, unauthorized } from "@/lib/http";
import { listJobsForRoleType } from "@/lib/role-types-data";

export const runtime = "nodejs";

/**
 * GET /api/role-types/:id/jobs
 * Jobs for one search. Snippets are bundled inline; the per-job snippet
 * endpoint was removed to avoid an N-request fan-out from the dashboard.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  const jobs = await listJobsForRoleType(session.user.id, id);
  if (jobs === null) return notFound("Search");

  return NextResponse.json({ jobs });
}
