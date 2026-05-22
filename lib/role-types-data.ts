import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  shapeRoleTypeJob,
  shapeRoleTypeJobs,
  shapeRoleTypeSource,
} from "@/lib/role-type-shape";
import type {
  RoleTypeJobDto,
  RoleTypeSourceDto,
  RoleTypeSummaryDto,
} from "@/lib/types";

export type { RoleTypeSummaryDto };

/**
 * Subset of `JobListing` columns we ever ship in list endpoints. Excludes
 * `payload` (potentially large jsonb) and a few audit columns that the UI
 * never reads.
 */
const JOB_LISTING_LIST_SELECT = {
  id: true,
  title: true,
  company: true,
  url: true,
  descriptionSnippet: true,
  postedAt: true,
  source: true,
  locationDisplay: true,
  workMode: true,
} satisfies Prisma.JobListingSelect;

function jobRowSelect(userId: string) {
  return {
    id: true,
    matchScore: true,
    addedAt: true,
    jobListing: {
      select: {
        ...JOB_LISTING_LIST_SELECT,
        userStates: {
          where: { userId },
          select: { favorite: true, hidden: true },
        },
      },
    },
  } satisfies Prisma.RoleTypeJobSelect;
}

interface SummaryCountRow {
  id: string;
  name: string;
  intent: string | null;
  sortOrder: number;
  totalJobCount: number;
  visibleJobCount: number;
}

/**
 * Single aggregate query per user instead of shipping one row per RoleTypeJob.
 * For a user with N searches × J jobs the old query returned O(N·J) rows just
 * to compute counts; this returns O(N) and lets Postgres do the GROUP BY.
 */
export async function listRoleTypeSummariesForUser(
  userId: string,
): Promise<RoleTypeSummaryDto[]> {
  const [countRows, sources] = await Promise.all([
    prisma.$queryRaw<SummaryCountRow[]>`
      SELECT
        rt.id,
        rt.name,
        rt.intent,
        rt."sortOrder",
        COUNT(rtj.id)::int AS "totalJobCount",
        COUNT(rtj.id) FILTER (
          WHERE NOT COALESCE(ujs.hidden, false)
        )::int AS "visibleJobCount"
      FROM "RoleType" rt
      LEFT JOIN "RoleTypeJob" rtj ON rtj."roleTypeId" = rt.id
      LEFT JOIN "UserJobState" ujs
        ON ujs."jobListingId" = rtj."jobListingId"
        AND ujs."userId" = rt."userId"
      WHERE rt."userId" = ${userId}
      GROUP BY rt.id
      ORDER BY rt."sortOrder" ASC, rt."createdAt" ASC
    `,
    prisma.roleTypeSource.findMany({
      where: { roleType: { userId } },
      orderBy: [{ roleTypeId: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const sourcesByRoleType = new Map<string, RoleTypeSourceDto[]>();
  for (const s of sources) {
    const list = sourcesByRoleType.get(s.roleTypeId) ?? [];
    list.push(shapeRoleTypeSource(s));
    sourcesByRoleType.set(s.roleTypeId, list);
  }

  return countRows.map((rt) => ({
    id: rt.id,
    name: rt.name,
    intent: rt.intent,
    sortOrder: rt.sortOrder,
    sources: sourcesByRoleType.get(rt.id) ?? [],
    visibleJobCount: rt.visibleJobCount,
    totalJobCount: rt.totalJobCount,
  }));
}

export async function listJobsForRoleType(
  userId: string,
  roleTypeId: string,
): Promise<RoleTypeJobDto[] | null> {
  const rt = await prisma.roleType.findFirst({
    where: { id: roleTypeId, userId },
    select: {
      id: true,
      jobs: {
        orderBy: { addedAt: "desc" },
        select: jobRowSelect(userId),
      },
    },
  });
  if (!rt) return null;
  return shapeRoleTypeJobs(rt.jobs);
}

export async function listAllJobsForUser(
  userId: string,
): Promise<
  Array<{ job: RoleTypeJobDto; roleTypeId: string; roleTypeName: string }>
> {
  const roleTypes = await prisma.roleType.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      jobs: {
        orderBy: { addedAt: "desc" },
        select: jobRowSelect(userId),
      },
    },
  });

  const rows: Array<{
    job: RoleTypeJobDto;
    roleTypeId: string;
    roleTypeName: string;
  }> = [];
  for (const rt of roleTypes) {
    for (const j of shapeRoleTypeJobs(rt.jobs)) {
      rows.push({ job: j, roleTypeId: rt.id, roleTypeName: rt.name });
    }
  }
  rows.sort((a, b) =>
    a.job.favorite !== b.job.favorite
      ? a.job.favorite
        ? -1
        : 1
      : new Date(b.job.addedAt).getTime() - new Date(a.job.addedAt).getTime(),
  );
  return rows;
}

export async function listAddedJobsForRoleType(
  userId: string,
  roleTypeId: string,
  roleTypeJobIds: string[],
): Promise<RoleTypeJobDto[]> {
  if (!roleTypeJobIds.length) return [];
  const rows = await prisma.roleTypeJob.findMany({
    where: {
      id: { in: roleTypeJobIds },
      roleTypeId,
      roleType: { userId },
    },
    select: jobRowSelect(userId),
  });
  return rows.map((r) => shapeRoleTypeJob(r));
}
