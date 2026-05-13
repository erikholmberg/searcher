/**
 * Shared pagination for providers that download a full list from an API but
 * expose it in slices so "find more" can append without re-ingesting the whole
 * board in one request.
 */
export const JOB_BOARD_SLICE_SIZE = 35;

/** Persisted between find-more calls; `completed` means every slice was seen. */
export type BoardSliceState = { offset: number } | { completed: true };

/** Page-based aggregators (Arbeitnow, Adzuna): `completed` = no more API pages. */
export type AggregatorPageState = { page: number } | { completed: true };

export function parseAggregatorPageState(
  state: unknown,
): { done: true } | { page: number } {
  if (
    state != null &&
    typeof state === "object" &&
    "completed" in state &&
    (state as { completed?: unknown }).completed === true
  ) {
    return { done: true };
  }
  if (state != null && typeof state === "object" && "page" in state) {
    const p = (state as { page?: unknown }).page;
    if (typeof p === "number" && p >= 1 && Number.isFinite(p)) {
      return { page: p };
    }
  }
  return { page: 1 };
}

export function resolveBoardSliceStart(
  state: unknown,
): { status: "done" } | { status: "slice"; offset: number } {
  if (state == null) return { status: "slice", offset: 0 };
  if (
    typeof state === "object" &&
    state !== null &&
    "completed" in state &&
    (state as { completed?: unknown }).completed === true
  ) {
    return { status: "done" };
  }
  if (typeof state === "object" && state !== null && "offset" in state) {
    const o = (state as { offset?: unknown }).offset;
    if (typeof o === "number" && o >= 0 && Number.isFinite(o)) {
      return { status: "slice", offset: o };
    }
  }
  return { status: "slice", offset: 0 };
}
