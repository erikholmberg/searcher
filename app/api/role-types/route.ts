import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { jsonError, unauthorized, zodError } from "@/lib/http";
import { RoleTypeCreate } from "@/lib/schemas";
import {
  attachSeedListingToRoleType,
  pickSeedSourceId,
} from "@/lib/jobs/seed-listing";
import { compareRoleTypeJobs } from "@/lib/compare-role-type-job";
import { ingestRoleType } from "@/lib/jobs/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/role-types
 * Returns role types for the signed-in user, with sources and visible jobs
 * (jobs hidden in UserJobState are excluded; favorited float to the top).
 */
export async function GET() {
  const session = await auth();
  if (!session) return unauthorized();
  const userId = session.user.id;

  const roleTypes = await prisma.roleType.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      sources: { orderBy: { createdAt: "asc" } },
      jobs: {
        orderBy: { addedAt: "desc" },
        include: {
          jobListing: {
            include: {
              userStates: { where: { userId } },
            },
          },
        },
      },
    },
  });

  const shaped = roleTypes.map((rt) => ({
    id: rt.id,
    name: rt.name,
    intent: rt.intent,
    sortOrder: rt.sortOrder,
    sources: rt.sources,
    jobs: rt.jobs
      .map((j) => {
        const state = j.jobListing.userStates[0];
        return {
          id: j.id,
          matchScore: j.matchScore,
          addedAt: j.addedAt,
          listing: {
            id: j.jobListing.id,
            title: j.jobListing.title,
            company: j.jobListing.company,
            url: j.jobListing.url,
            descriptionSnippet: j.jobListing.descriptionSnippet,
            postedAt: j.jobListing.postedAt,
            source: j.jobListing.source,
            locationDisplay: j.jobListing.locationDisplay,
            workMode: j.jobListing.workMode,
          },
          favorite: state?.favorite ?? false,
          hidden: state?.hidden ?? false,
        };
      })
      .sort(compareRoleTypeJobs),
  }));

  return NextResponse.json({ roleTypes: shaped });
}

/**
 * POST /api/role-types
 * Create a role type, optionally with initial sources (manual or AI preview).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return unauthorized();
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Body must be JSON", 400);
  }

  const parsed = RoleTypeCreate.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { name, intent, sortOrder, sources, seedListing } = parsed.data;

  const roleType = await prisma.roleType.create({
    data: {
      userId,
      name,
      intent: intent ?? null,
      sortOrder: sortOrder ?? 0,
      sources: {
        create: sources.map((s) => ({
          kind: s.kind,
          config: s.config,
        })),
      },
    },
    include: { sources: true },
  });

  let seedJobListingId: string | undefined;
  if (seedListing) {
    const seed = {
      externalId: seedListing.externalId,
      source: seedListing.source,
      title: seedListing.title,
      company: seedListing.company,
      url: seedListing.url,
      descriptionSnippet: seedListing.descriptionSnippet ?? null,
      postedAt: seedListing.postedAt ?? null,
      locationDisplay: seedListing.locationDisplay ?? null,
      workMode: seedListing.workMode,
    };
    const sourceId = pickSeedSourceId(roleType.sources, seed);
    seedJobListingId = await attachSeedListingToRoleType(roleType.id, seed, {
      sourceId,
    });
  }

  const hasCareersSite = sources.some((s) => s.kind === "careers_site");
  let ingestSummary = null;
  if (hasCareersSite) {
    try {
      ingestSummary = await ingestRoleType(roleType.id, { mode: "refresh" });
    } catch (err) {
      ingestSummary = {
        addedCount: 0,
        skippedIrrelevant: 0,
        exhausted: false,
        perSource: [],
        error: (err as Error).message,
      };
    }
  }

  return NextResponse.json(
    { roleType, ingestSummary, seedJobListingId },
    { status: 201 },
  );
}
