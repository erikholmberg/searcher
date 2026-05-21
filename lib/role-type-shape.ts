import { compareRoleTypeJobs } from "@/lib/compare-role-type-job";
import type { RoleTypeJobDto, RoleTypeSourceDto } from "@/lib/types";
import type { Prisma } from "@prisma/client";

type JobRowWithListing = {
  id: string;
  matchScore: number | null;
  addedAt: Date;
  jobListing: {
    id: string;
    title: string;
    company: string;
    url: string;
    descriptionSnippet: string | null;
    postedAt: Date | null;
    source: string;
    locationDisplay: string | null;
    workMode: string;
    userStates: Array<{ favorite: boolean; hidden: boolean }>;
  };
};

export function shapeRoleTypeJob(
  j: JobRowWithListing,
  options?: { includeSnippet?: boolean },
): RoleTypeJobDto {
  const state = j.jobListing.userStates[0];
  const includeSnippet = options?.includeSnippet !== false;
  return {
    id: j.id,
    matchScore: j.matchScore,
    addedAt: j.addedAt.toISOString(),
    listing: {
      id: j.jobListing.id,
      title: j.jobListing.title,
      company: j.jobListing.company,
      url: j.jobListing.url,
      descriptionSnippet: includeSnippet
        ? j.jobListing.descriptionSnippet
        : null,
      postedAt: j.jobListing.postedAt?.toISOString() ?? null,
      source: j.jobListing.source,
      locationDisplay: j.jobListing.locationDisplay,
      workMode: j.jobListing.workMode as RoleTypeJobDto["listing"]["workMode"],
    },
    favorite: state?.favorite ?? false,
    hidden: state?.hidden ?? false,
  };
}

export function shapeRoleTypeJobs(
  jobs: JobRowWithListing[],
  options?: { includeSnippet?: boolean },
): RoleTypeJobDto[] {
  return jobs
    .map((j) => shapeRoleTypeJob(j, options))
    .sort(compareRoleTypeJobs);
}

export function shapeRoleTypeSource(
  s: Prisma.RoleTypeSourceGetPayload<object>,
): RoleTypeSourceDto {
  return {
    id: s.id,
    roleTypeId: s.roleTypeId,
    kind: s.kind as RoleTypeSourceDto["kind"],
    config: s.config,
    paginationState: s.paginationState,
    lastFetchedAt: s.lastFetchedAt?.toISOString() ?? null,
    lastErrorMessage: s.lastErrorMessage,
  };
}
