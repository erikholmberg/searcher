import type { RoleTypeJobDto } from "@/lib/types";

type JobRowSortable = Pick<RoleTypeJobDto, "favorite"> & {
  addedAt: RoleTypeJobDto["addedAt"] | Date;
};

function addedAtMs(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** Favorites first, then most recently added to the search first. */
export function compareRoleTypeJobs(a: JobRowSortable, b: JobRowSortable): number {
  if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
  return addedAtMs(b.addedAt) - addedAtMs(a.addedAt);
}
