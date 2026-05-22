import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorized } from "@/lib/http";
import { listAllJobsForUser } from "@/lib/role-types-data";

export const runtime = "nodejs";

/**
 * GET /api/jobs
 * Flat list of all jobs across searches (for All Jobs view). Snippets are
 * bundled inline.
 */
export async function GET() {
  const session = await auth();
  if (!session) return unauthorized();

  const rows = await listAllJobsForUser(session.user.id);
  return NextResponse.json({ rows });
}
