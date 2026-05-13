import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { jsonError, notFound, unauthorized, zodError } from "@/lib/http";
import { SourceInput } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return unauthorized();
  const userId = session.user.id;
  const { id } = await ctx.params;

  const rt = await prisma.roleType.findUnique({ where: { id } });
  if (!rt || rt.userId !== userId) return notFound("RoleType");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Body must be JSON", 400);
  }
  const parsed = SourceInput.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const source = await prisma.roleTypeSource.create({
    data: {
      roleTypeId: id,
      kind: parsed.data.kind,
      config: parsed.data.config,
    },
  });

  return NextResponse.json({ source }, { status: 201 });
}
