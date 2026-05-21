/**
 * Shared shapes used by the dashboard UI.
 */
export type WorkMode = "remote" | "hybrid" | "onsite" | "unknown";

export type SourceKindString =
  | "adzuna_query"
  | "arbeitnow_query"
  | "remotive_query"
  | "greenhouse_board"
  | "lever_board"
  | "ashby_board"
  | "public_job_posting"
  | "careers_site";

export interface JobListingDto {
  id: string;
  title: string;
  company: string;
  url: string;
  descriptionSnippet: string | null;
  postedAt: string | null;
  source: string;
  locationDisplay: string | null;
  workMode: WorkMode;
}

export interface RoleTypeJobDto {
  id: string;
  matchScore: number | null;
  addedAt: string;
  listing: JobListingDto;
  favorite: boolean;
  hidden: boolean;
}

export interface RoleTypeSourceDto {
  id: string;
  roleTypeId: string;
  kind: SourceKindString;
  config: unknown;
  paginationState: unknown;
  lastFetchedAt: string | null;
  lastErrorMessage: string | null;
}

/** Search metadata without job rows (from GET /api/role-types). */
export interface RoleTypeSummaryDto {
  id: string;
  name: string;
  intent: string | null;
  sortOrder: number;
  sources: RoleTypeSourceDto[];
  visibleJobCount: number;
  totalJobCount: number;
}

/** Search with jobs loaded (client-side aggregate). */
export interface RoleTypeDto extends RoleTypeSummaryDto {
  jobs: RoleTypeJobDto[];
}

export const SOURCE_KIND_OPTIONS: { value: SourceKindString; label: string; family: "aggregator" | "ats" }[] =
  [
    { value: "arbeitnow_query", label: "Arbeitnow search (keyword)", family: "aggregator" },
    { value: "remotive_query", label: "Remotive search (remote)", family: "aggregator" },
    { value: "adzuna_query", label: "Adzuna search (needs API key)", family: "aggregator" },
    { value: "greenhouse_board", label: "Greenhouse board", family: "ats" },
    { value: "lever_board", label: "Lever board", family: "ats" },
    { value: "ashby_board", label: "Ashby board", family: "ats" },
    {
      value: "public_job_posting",
      label: "Public job page (https HTML)",
      family: "aggregator",
    },
    {
      value: "careers_site",
      label: "Careers site (similar roles)",
      family: "aggregator",
    },
  ];
