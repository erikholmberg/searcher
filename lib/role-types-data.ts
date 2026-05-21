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

export async function listRoleTypeSummariesForUser(
  userId: string,
): Promise<RoleTypeSummaryDto[]> {
  const roleTypes = await prisma.roleType.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      sources: { orderBy: { createdAt: "asc" } },
      jobs: {
        select: {
          id: true,
          jobListing: {
            select: {
              userStates: {
                where: { userId },
                select: { hidden: true },
              },
            },
          },
        },
      },
    },
  });

  return roleTypes.map((rt) => {
    const totalJobCount = rt.jobs.length;
    const visibleJobCount = rt.jobs.filter(
      (j) => !(j.jobListing.userStates[0]?.hidden ?? false),
    ).length;
    return {
      id: rt.id,
      name: rt.name,
      intent: rt.intent,
      sortOrder: rt.sortOrder,
      sources: rt.sources.map(shapeRoleTypeSource),
      visibleJobCount,
      totalJobCount,
    };
  });
}

export async function listJobsForRoleType(
  userId: string,
  roleTypeId: string,
  options?: { includeSnippet?: boolean },
): Promise<RoleTypeJobDto[] | null> {
  const rt = await prisma.roleType.findFirst({
    where: { id: roleTypeId, userId },
    include: {
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
  if (!rt) return null;
  return shapeRoleTypeJobs(rt.jobs, options);
}

export async function listAllJobsForUser(
  userId: string,
  options?: { includeSnippet?: boolean },
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

  const rows: Array<{
    job: RoleTypeJobDto;
    roleTypeId: string;
    roleTypeName: string;
  }> = [];
  for (const rt of roleTypes) {
    for (const j of shapeRoleTypeJobs(rt.jobs, options)) {
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

export async function getJobSnippet(
  userId: string,
  jobListingId: string,
): Promise<string | null | undefined> {
  const link = await prisma.roleTypeJob.findFirst({
    where: {
      jobListingId,
      roleType: { userId },
    },
    select: {
      jobListing: { select: { descriptionSnippet: true } },
    },
  });
  if (!link) return undefined;
  return link.jobListing.descriptionSnippet;
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
    include: {
      jobListing: {
        include: {
          userStates: { where: { userId } },
        },
      },
    },
  });
  return shapeRoleTypeJobs(rows, { includeSnippet: false });
}
