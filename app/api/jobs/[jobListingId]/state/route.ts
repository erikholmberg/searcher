import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { jsonError, notFound, unauthorized, zodError } from "@/lib/http";
import { JobStateUpdate } from "@/lib/schemas";

export const runtime = "nodejs";

/**
 * PATCH /api/jobs/:jobListingId/state
 * Body: { favorite?, hidden?, status?, notes? }
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
  const { favorite, hidden, status, notes } = parsed.data;
  if (
    favorite === undefined &&
    hidden === undefined &&
    status === undefined &&
    notes === undefined
  ) {
    return jsonError("Provide at least one field to update", 400);
  }

  const exists = await prisma.jobListing.findUnique({
    where: { id: jobListingId },
    select: { id: true },
  });
  if (!exists) return notFound("Job");

  const linkedToUser = await prisma.roleTypeJob.findFirst({
    where: { jobListingId, roleType: { userId } },
    select: { id: true },
  });
  if (!linkedToUser) return jsonError("Forbidden", 403);

  const now = new Date();
  const state = await prisma.userJobState.upsert({
    where: { userId_jobListingId: { userId, jobListingId } },
    update: {
      ...(favorite !== undefined ? { favorite, favoritedAt: favorite ? now : null } : {}),
      ...(hidden !== undefined ? { hidden, hiddenAt: hidden ? now : null } : {}),
      ...(status !== undefined ? { status, statusAt: now } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
    create: {
      userId,
      jobListingId,
      favorite: favorite ?? false,
      hidden: hidden ?? false,
      status: status ?? "saved",
      notes: notes ?? null,
      favoritedAt: favorite ? now : null,
      hiddenAt: hidden ? now : null,
      statusAt: status !== undefined ? now : null,
    },
  });

  return NextResponse.json({ state });
}
