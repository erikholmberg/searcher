import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { notFound, unauthorized } from "@/lib/http";
import { ingestRoleType } from "@/lib/jobs/ingest";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/role-types/:id/find-more
 *
 * Advances paginationState (or runs diff fetch) for each source and appends
 * only RoleTypeJob rows that aren't already present for this role type.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return unauthorized();
  const rl = enforceRateLimit(req, {
    scope: "find-more",
    userId: session.user.id,
    limit: 30,
    windowMs: 5 * 60_000,
  });
  if (rl) return rl;
  const { id } = await ctx.params;

  const rt = await prisma.roleType.findUnique({ where: { id } });
  if (!rt || rt.userId !== session.user.id) return notFound("RoleType");

  const summary = await ingestRoleType(id, { mode: "find-more" });
  return NextResponse.json(summary);
}
