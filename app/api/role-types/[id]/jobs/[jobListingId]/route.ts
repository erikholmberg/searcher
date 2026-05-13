import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { jsonError, notFound, unauthorized } from "@/lib/http";

export const runtime = "nodejs";

/**
 * DELETE /api/role-types/:id/jobs/:jobListingId
 *
 * Removes the job from this role type and records a dismissal so refresh/find-more
 * does not surface the same posting again in this bucket.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; jobListingId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const userId = session.user.id;
  const { id: roleTypeId, jobListingId } = await ctx.params;

  try {
    const roleType = await prisma.roleType.findFirst({
      where: { id: roleTypeId, userId },
      select: { id: true },
    });
    if (!roleType) return notFound("Role type");

    const link = await prisma.roleTypeJob.findFirst({
      where: { roleTypeId, jobListingId },
      include: { jobListing: { select: { externalId: true } } },
    });
    if (!link) return notFound("Job");

    // Avoid prisma.$transaction([...]) here: multi-statement transactions often fail
    // against PgBouncer (e.g. Supabase pooler). Order is safe for partial failure.
    await prisma.roleTypeDismissedJob.createMany({
      data: [{ roleTypeId, externalId: link.jobListing.externalId }],
      skipDuplicates: true,
    });

    await prisma.roleTypeJob.delete({ where: { id: link.id } });
    await prisma.userJobState.deleteMany({ where: { userId, jobListingId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE role-type job]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    const hint =
      /does not exist|Unknown table|P2021/i.test(message)
        ? " Database schema may be out of date — run `npm run db:push`."
        : "";
    return jsonError(
      process.env.NODE_ENV === "development"
        ? `${message}${hint}`
        : `Could not remove job.${hint}`,
      500,
    );
  }
}
