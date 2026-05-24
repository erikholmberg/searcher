import { compareRoleTypeJobs } from "@/lib/compare-role-type-job";
import type { JobStatus, RoleTypeJobDto, RoleTypeSourceDto } from "@/lib/types";
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
    userStates: Array<{ favorite: boolean; hidden: boolean; status: string; notes: string | null }>;
  };
};

export function shapeRoleTypeJob(j: JobRowWithListing): RoleTypeJobDto {
  const state = j.jobListing.userStates[0];
  return {
    id: j.id,
    matchScore: j.matchScore,
    addedAt: j.addedAt.toISOString(),
    listing: {
      id: j.jobListing.id,
      title: j.jobListing.title,
      company: j.jobListing.company,
      url: j.jobListing.url,
      descriptionSnippet: j.jobListing.descriptionSnippet,
      postedAt: j.jobListing.postedAt?.toISOString() ?? null,
      source: j.jobListing.source,
      locationDisplay: j.jobListing.locationDisplay,
      workMode: j.jobListing.workMode as RoleTypeJobDto["listing"]["workMode"],
    },
    favorite: state?.favorite ?? false,
    hidden: state?.hidden ?? false,
    status: (state?.status ?? "saved") as JobStatus,
    notes: state?.notes ?? null,
  };
}

export function shapeRoleTypeJobs(
  jobs: JobRowWithListing[],
): RoleTypeJobDto[] {
  return jobs.map(shapeRoleTypeJob).sort(compareRoleTypeJobs);
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
