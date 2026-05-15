---
name: All jobs header view
overview: Add an "All jobs" control in the dashboard layout header and a unified list that flattens every `RoleTypeJob` across searches—sorted by favorite first, then date added (`addedAt` desc)—reuse `JobRow` with a search label and show date added on every job card.
todos:
  - id: layout-nav
    content: Add All jobs (+ optional Searches) Links in app/dashboard/layout.tsx
    status: completed
  - id: page-suspense
    content: Wrap Dashboard in Suspense in app/dashboard/page.tsx
    status: completed
  - id: dashboard-all-view
    content: "dashboard.tsx: useSearchParams, flatten/sort (favorite then addedAt desc), view=all panel, router.replace on sidebar pick"
    status: completed
  - id: job-row-label
    content: "job-row.tsx: optional searchLabel; show date added (addedAt) on card"
    status: completed
  - id: api-sort
    content: "GET /api/role-types: sort jobs by favorite then addedAt desc (match current product rule)"
    status: completed
isProject: false
---

# All jobs view (header button)

## Behavior

- **Placement**: In [`app/dashboard/layout.tsx`](app/dashboard/layout.tsx), next to the "Searcher" home link, add a nav link **All jobs** pointing to `/dashboard?view=all`. Optionally add a **Searches** (or rely on the logo) link to `/dashboard` to clear the aggregate view—otherwise users only exit "all" by picking a search in the sidebar.
- **Main panel**: When `view=all`, show a title (e.g. "All jobs"), optional short description, the same **Show hidden** pattern as a single search (reuse `showHidden` or mirror it—simplest is one shared `showHidden` for the active panel), and a **flattened list** of jobs from all `roleTypes`.
- **Data**: No new API. Reuse existing [`GET /api/role-types`](app/api/role-types/route.ts) payload: iterate each `RoleTypeDto.jobs`, attach `roleTypeId` + `roleTypeName` for each row.
- **Sort** (single search **and** all-jobs aggregate): (1) **Favorites first** (`favorite === true` before false). (2) Then **date added** descending: use `RoleTypeJobDto.addedAt` (when the job was linked to the search), not `matchScore` or `postedAt`. Apply the same comparator in [`app/api/role-types/route.ts`](app/api/role-types/route.ts) when shaping each search’s `jobs` array, and again when flattening/sorting the all-jobs list in [`components/dashboard.tsx`](components/dashboard.tsx) so behavior matches after refetches.
- **Row UI**: Extend [`components/job-row.tsx`](components/job-row.tsx) with:
  - Optional `searchLabel?: string` (for “All jobs”): muted line, e.g. search name.
  - **Date added**: Always show `job.addedAt` on the card (e.g. `Added …` or a dot-separated segment next to company/location), localized date, distinct from **Posted** (`listing.postedAt`) which already appears when present.
- **Actions**: Unchanged (favorite, hide, remove-from-search, external link); `removeFromList` and `onChanged` still use that row’s `roleTypeId`.

## Routing / state

- Use the **`view=all`** query param as the source of truth so the layout can stay a server component with plain `<Link>`s.
- In [`components/dashboard.tsx`](components/dashboard.tsx) (client): `useSearchParams()` from `next/navigation`; derive `viewAll = searchParams.get("view") === "all"`.
- When the user clicks a **search** in the sidebar, call `router.replace("/dashboard")` (or `"/dashboard?view=search"` if you prefer an explicit mode) so the aggregate view clears.
- Wrap [`Dashboard`](components/dashboard.tsx) in [`app/dashboard/page.tsx`](app/dashboard/page.tsx) with `<Suspense fallback={...}>` so `useSearchParams` is supported without static rendering issues (Next.js pattern).

## UI edge cases

- **`view=all` with zero searches / zero jobs**: Show an empty state ("No jobs yet") distinct from "No search selected".
- **Loading**: While `roleTypes` is null/loading, show skeletons for the all-jobs panel when `viewAll` is true (same as single-search loading).
- **Sidebar selection**: When `viewAll`, do not highlight a search row; `selectedId` can remain the last selected search for when the user switches back, or `selectedId` can be cleared—pick one and apply `aria-current` / `bg-muted` only for the active sidebar item when `!viewAll`.

## Files to touch

| File | Change |
|------|--------|
| [`app/dashboard/layout.tsx`](app/dashboard/layout.tsx) | Header nav: `Link` to `/dashboard?view=all` (and optional `/dashboard` for default). |
| [`app/dashboard/page.tsx`](app/dashboard/page.tsx) | `Suspense` around `Dashboard`. |
| [`components/dashboard.tsx`](components/dashboard.tsx) | Read `view`; conditional main content; `useMemo` flatten + **favorite → addedAt desc** sort; `router.replace` on search pick; empty/loading for all view. |
| [`components/job-row.tsx`](components/job-row.tsx) | Optional `searchLabel`; display **`addedAt`** on every card. |
| [`app/api/role-types/route.ts`](app/api/role-types/route.ts) | Replace job sort with **favorite → addedAt desc** (drop matchScore/postedAt tie-break) so per-search list matches. |
| [`README.md`](README.md) | One sentence under Features (optional). |

## Out of scope

- Deduping the same `JobListing` across multiple searches (can show duplicate rows with different labels, or dedupe later).
- New `GET /api/jobs` endpoint.
