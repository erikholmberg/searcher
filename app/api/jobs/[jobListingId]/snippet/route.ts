import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { notFound, unauthorized } from "@/lib/http";
import { getJobSnippet } from "@/lib/role-types-data";

export const runtime = "nodejs";

/**
 * GET /api/jobs/:jobListingId/snippet
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ jobListingId: string }> },
) {
  const session = await auth();
  if (!session) return unauthorized();
  const { jobListingId } = await ctx.params;

  const snippet = await getJobSnippet(session.user.id, jobListingId);
  if (snippet === undefined) return notFound("Job");

  return NextResponse.json({ snippet });
}
