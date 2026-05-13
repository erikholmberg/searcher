import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { jsonError, notFound, unauthorized, zodError } from "@/lib/http";
import { JobStateUpdate } from "@/lib/schemas";

export const runtime = "nodejs";

/**
 * PATCH /api/jobs/:jobListingId/state
 * Body: { favorite?: boolean, hidden?: boolean }
 *
 * Upserts the per-user state for this job.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ jobListingId: string }> },
) {
  const session = await auth();
  if (!session) return unauthorized();
  const userId = session.user.id;
  const { jobListingId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Body must be JSON", 400);
  }
  const parsed = JobStateUpdate.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { favorite, hidden } = parsed.data;
  if (favorite === undefined && hidden === undefined) {
    return jsonError("Provide favorite and/or hidden", 400);
  }

  const exists = await prisma.jobListing.findUnique({
    where: { id: jobListingId },
    select: { id: true },
  });
  if (!exists) return notFound("Job");

  // Authorization guard: user can only mutate state for jobs surfaced to one
  // of their role types.
  const linkedToUser = await prisma.roleTypeJob.findFirst({
    where: {
      jobListingId,
      roleType: { userId },
    },
    select: { id: true },
  });
  if (!linkedToUser) {
    return jsonError("Forbidden", 403);
  }

  const now = new Date();
  const state = await prisma.userJobState.upsert({
    where: { userId_jobListingId: { userId, jobListingId } },
    update: {
      ...(favorite !== undefined ? { favorite, favoritedAt: favorite ? now : null } : {}),
      ...(hidden !== undefined ? { hidden, hiddenAt: hidden ? now : null } : {}),
    },
    create: {
      userId,
      jobListingId,
      favorite: favorite ?? false,
      hidden: hidden ?? false,
      favoritedAt: favorite ? now : null,
      hiddenAt: hidden ? now : null,
    },
  });

  return NextResponse.json({ state });
}
