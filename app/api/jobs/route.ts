import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorized } from "@/lib/http";
import { listAllJobsForUser } from "@/lib/role-types-data";

export const runtime = "nodejs";

/**
 * GET /api/jobs
 * Flat list of all jobs across searches (for All Jobs view).
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return unauthorized();
  const url = new URL(req.url);
  const includeSnippet = url.searchParams.get("snippets") === "1";

  const rows = await listAllJobsForUser(session.user.id, { includeSnippet });
  return NextResponse.json({ rows });
}
