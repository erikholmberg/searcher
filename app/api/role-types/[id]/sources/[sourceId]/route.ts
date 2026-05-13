import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { jsonError, notFound, unauthorized, zodError } from "@/lib/http";
import { AggregatorQueryConfig, AtsBoardConfig, SourceUpdate } from "@/lib/schemas";

export const runtime = "nodejs";

async function loadOwnedSource(
  roleTypeId: string,
  sourceId: string,
  userId: string,
) {
  const source = await prisma.roleTypeSource.findUnique({
    where: { id: sourceId },
    include: { roleType: true },
  });
  if (!source || source.roleTypeId !== roleTypeId) return null;
  if (source.roleType.userId !== userId) return null;
  return source;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  if (
    typeof a === "object" &&
    typeof b === "object" &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => deepEqual(aObj[k], bObj[k]));
  }
  return false;
}

function isAtsKind(kind: string) {
  return kind.endsWith("_board");
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; sourceId: string }> },
) {
  const session = await auth();
  if (!session) return unauthorized();
  const userId = session.user.id;
  const { id, sourceId } = await ctx.params;

  const existing = await loadOwnedSource(id, sourceId, userId);
  if (!existing) return notFound("Source");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Body must be JSON", 400);
  }
  const parsed = SourceUpdate.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const configValidation = isAtsKind(existing.kind)
    ? AtsBoardConfig.safeParse(parsed.data.config)
    : AggregatorQueryConfig.safeParse(parsed.data.config);
  if (!configValidation.success) {
    return zodError(configValidation.error);
  }

  const changed = !deepEqual(existing.config, configValidation.data);
  if (!changed) {
    return NextResponse.json({ source: existing });
  }

  // Reset paginationState only when config meaningfully changes.
  const updated = await prisma.roleTypeSource.update({
    where: { id: sourceId },
    data: {
      config: configValidation.data,
      paginationState: null as never,
    },
  });
  return NextResponse.json({ source: updated });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; sourceId: string }> },
) {
  const session = await auth();
  if (!session) return unauthorized();
  const userId = session.user.id;
  const { id, sourceId } = await ctx.params;

  const existing = await loadOwnedSource(id, sourceId, userId);
  if (!existing) return notFound("Source");

  await prisma.roleTypeSource.delete({ where: { id: sourceId } });
  return NextResponse.json({ ok: true });
}
