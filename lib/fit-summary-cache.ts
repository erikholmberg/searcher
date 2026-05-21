const PREFIX = "searcher:fit:";

export function fitCacheKey(roleTypeId: string, jobListingId: string): string {
  return `${PREFIX}${roleTypeId}:${jobListingId}`;
}

export function readFitSummary(
  roleTypeId: string,
  jobListingId: string,
): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(fitCacheKey(roleTypeId, jobListingId));
  } catch {
    return null;
  }
}

export function writeFitSummary(
  roleTypeId: string,
  jobListingId: string,
  text: string,
): void {
  if (typeof sessionStorage === "undefined" || !text.trim()) return;
  try {
    sessionStorage.setItem(fitCacheKey(roleTypeId, jobListingId), text);
  } catch {
    /* quota */
  }
}
