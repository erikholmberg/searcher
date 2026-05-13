import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { jsonError, notFound, unauthorized, zodError } from "@/lib/http";
import { RoleTypeUpdate } from "@/lib/schemas";

export const runtime = "nodejs";

async function loadOwned(id: string, userId: string) {
  const rt = await prisma.roleType.findUnique({ where: { id } });
  if (!rt || rt.userId !== userId) return null;
  return rt;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return unauthorized();
  const userId = session.user.id;
  const { id } = await ctx.params;

  const rt = await prisma.roleType.findUnique({
    where: { id },
    include: { sources: true },
  });
  if (!rt || rt.userId !== userId) return notFound("RoleType");

  return NextResponse.json({ roleType: rt });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return unauthorized();
  const userId = session.user.id;
  const { id } = await ctx.params;

  const owned = await loadOwned(id, userId);
  if (!owned) return notFound("RoleType");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Body must be JSON", 400);
  }
  const parsed = RoleTypeUpdate.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.intent !== undefined) data.intent = parsed.data.intent;
  if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;

  const updated = await prisma.roleType.update({ where: { id }, data });
  return NextResponse.json({ roleType: updated });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return unauthorized();
  const userId = session.user.id;
  const { id } = await ctx.params;

  const owned = await loadOwned(id, userId);
  if (!owned) return notFound("RoleType");

  await prisma.roleType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
