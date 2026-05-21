"use client";

import * as React from "react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { JobRow } from "@/components/job-row";
import {
  NewRoleTypeDialog,
  type CreatedRoleTypeResult,
} from "@/components/new-role-type-dialog";
import { EditRoleTypeDialog } from "@/components/edit-role-type-dialog";
import { SourcesSheet } from "@/components/sources-sheet";
import { VirtualJobList } from "@/components/virtual-job-list";
import { api } from "@/lib/api-client";
import {
  RoleTypeDto,
  RoleTypeJobDto,
  RoleTypeSummaryDto,
} from "@/lib/types";
import { Loader2, Plus, RefreshCw, Settings2, Trash2 } from "lucide-react";

import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { compareRoleTypeJobs } from "@/lib/compare-role-type-job";
import {
  dragPayloadMayContainUrl,
  extractHttpsJobUrl,
} from "@/lib/url-from-drop";
import { TruncateWithTooltip } from "@/components/truncate-with-tooltip";
import {
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  useResizableSidebarWidth,
} from "@/hooks/use-resizable-sidebar-width";

function mergeJobs(
  existing: RoleTypeJobDto[],
  added: RoleTypeJobDto[],
): RoleTypeJobDto[] {
  const byListing = new Map(existing.map((j) => [j.listing.id, j]));
  for (const j of added) {
    byListing.set(j.listing.id, j);
  }
  return [...byListing.values()].sort(compareRoleTypeJobs);
}

function summaryWithCounts(
  summary: RoleTypeSummaryDto,
  jobs: RoleTypeJobDto[],
): RoleTypeSummaryDto {
  const visibleJobCount = jobs.filter((j) => !j.hidden).length;
  return {
    ...summary,
    visibleJobCount,
    totalJobCount: jobs.length,
  };
}

function SidebarSearchItem({
  name,
  count,
  selected,
  onSelect,
}: {
  name: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const [tooltipTitle, setTooltipTitle] = React.useState<string | undefined>();
  const handleTruncatedChange = React.useCallback(
    (truncated: boolean) => setTooltipTitle(truncated ? name : undefined),
    [name],
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      title={tooltipTitle}
      className={cn(
        "w-full text-left text-sm px-2 py-1.5 rounded-md flex items-center justify-between gap-2 hover:bg-muted min-w-0",
        selected && "bg-muted",
      )}
    >
      <TruncateWithTooltip
        className="min-w-0 flex-1"
        onTruncatedChange={handleTruncatedChange}
      >
        {name}
      </TruncateWithTooltip>
      <Badge variant="secondary" className="shrink-0 text-xs">
        {count}
      </Badge>
    </button>
  );
}

type AllJobRow = {
  job: RoleTypeJobDto;
  roleTypeId: string;
  roleTypeName: string;
};

type Props = {
  initialSummaries?: RoleTypeSummaryDto[] | null;
};

export function Dashboard({ initialSummaries = null }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewAll = searchParams.get("view") === "all";
  const [summaries, setSummaries] = React.useState<RoleTypeSummaryDto[] | null>(
    initialSummaries,
  );
  const [jobsByRoleTypeId, setJobsByRoleTypeId] = React.useState<
    Record<string, RoleTypeJobDto[]>
  >({});
  const [allJobsRows, setAllJobsRows] = React.useState<AllJobRow[] | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [loadingSummaries, setLoadingSummaries] = React.useState(
    initialSummaries === null,
  );
  const [jobsLoadingId, setJobsLoadingId] = React.useState<string | null>(null);
  const [allJobsLoading, setAllJobsLoading] = React.useState(false);
  const [fetching, setFetching] = React.useState<string | null>(null);
  const [showHidden, setShowHidden] = React.useState(false);
  const [createDialog, setCreateDialog] = React.useState<{
    open: boolean;
    startWithUrl: string | null;
  }>({ open: false, startWithUrl: null });
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [highlightJobListingId, setHighlightJobListingId] = React.useState<
    string | null
  >(null);
  const dragDepthRef = React.useRef(0);
  const highlightTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const mainScrollRef = React.useRef<HTMLDivElement>(null);
  const allJobsScrollRef = React.useRef<HTMLDivElement>(null);
  const { width: sidebarWidth, startResize, resetWidth, onSeparatorKeyDown } =
    useResizableSidebarWidth();

  const loadSummaries = React.useCallback(async () => {
    setLoadingSummaries(true);
    try {
      const res = await api<{ roleTypes: RoleTypeSummaryDto[] }>(
        "/api/role-types",
      );
      setSummaries(res.roleTypes);
      setSelectedId((prev) => {
        if (prev && res.roleTypes.find((rt) => rt.id === prev)) return prev;
        return res.roleTypes[0]?.id ?? null;
      });
    } catch (err) {
      toast.error((err as Error).message || "Failed to load searches");
    } finally {
      setLoadingSummaries(false);
    }
  }, []);

  const loadJobsForRoleType = React.useCallback(
    async (roleTypeId: string) => {
      setJobsLoadingId(roleTypeId);
      try {
        const res = await api<{ jobs: RoleTypeJobDto[] }>(
          `/api/role-types/${roleTypeId}/jobs`,
        );
        setJobsByRoleTypeId((prev) => ({
          ...prev,
          [roleTypeId]: res.jobs,
        }));
      } catch (err) {
        toast.error((err as Error).message || "Failed to load jobs");
      } finally {
        setJobsLoadingId((id) => (id === roleTypeId ? null : id));
      }
    },
    [],
  );

  const loadAllJobs = React.useCallback(async () => {
    setAllJobsLoading(true);
    try {
      const res = await api<{ rows: AllJobRow[] }>("/api/jobs");
      setAllJobsRows(res.rows);
    } catch (err) {
      toast.error((err as Error).message || "Failed to load all jobs");
    } finally {
      setAllJobsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (initialSummaries === null) {
      void loadSummaries();
    } else if (selectedId === null && initialSummaries.length > 0) {
      setSelectedId(initialSummaries[0].id);
    }
  }, [initialSummaries, loadSummaries, selectedId]);

  React.useEffect(() => {
    if (viewAll) {
      if (allJobsRows === null) void loadAllJobs();
      return;
    }
    if (selectedId && jobsByRoleTypeId[selectedId] === undefined) {
      void loadJobsForRoleType(selectedId);
    }
  }, [
    viewAll,
    selectedId,
    allJobsRows,
    jobsByRoleTypeId,
    loadAllJobs,
    loadJobsForRoleType,
  ]);

  const selectedSummary =
    summaries?.find((rt) => rt.id === selectedId) ?? null;
  const selectedJobs =
    selectedId != null ? jobsByRoleTypeId[selectedId] : undefined;
  const selected: RoleTypeDto | null =
    selectedSummary && selectedJobs
      ? { ...selectedSummary, jobs: selectedJobs }
      : null;

  const visibleJobs = selected?.jobs.filter((j) => !j.hidden) ?? [];
  const hiddenJobs = selected?.jobs.filter((j) => j.hidden) ?? [];

  React.useEffect(() => {
    if (!highlightJobListingId || viewAll || !selected) return;
    const el = document.getElementById(`job-listing-${highlightJobListingId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightJobListingId, viewAll, selected, visibleJobs.length]);

  const allVisibleJobs = (allJobsRows ?? []).filter(({ job }) => !job.hidden);
  const allHiddenJobs = (allJobsRows ?? []).filter(({ job }) => job.hidden);

  function updateLocalJob(roleTypeId: string, next: RoleTypeJobDto) {
    setJobsByRoleTypeId((prev) => {
      const jobs = prev[roleTypeId];
      if (!jobs) return prev;
      const nextJobs = jobs
        .map((j) => (j.listing.id === next.listing.id ? next : j))
        .sort(compareRoleTypeJobs);
      setSummaries((all) =>
        all
          ? all.map((s) =>
              s.id === roleTypeId
                ? summaryWithCounts(s, nextJobs)
                : s,
            )
          : all,
      );
      return { ...prev, [roleTypeId]: nextJobs };
    });
    setAllJobsRows((rows) =>
      rows
        ? rows.map((row) =>
            row.roleTypeId === roleTypeId && row.job.listing.id === next.listing.id
              ? { ...row, job: next }
              : row,
          )
        : rows,
    );
  }

  function removeLocalJob(roleTypeId: string, listingId: string) {
    setJobsByRoleTypeId((prev) => {
      const jobs = prev[roleTypeId];
      if (!jobs) return prev;
      const nextJobs = jobs.filter((j) => j.listing.id !== listingId);
      setSummaries((all) =>
        all
          ? all.map((s) =>
              s.id === roleTypeId ? summaryWithCounts(s, nextJobs) : s,
            )
          : all,
      );
      return { ...prev, [roleTypeId]: nextJobs };
    });
    setAllJobsRows((rows) =>
      rows
        ? rows.filter(
            (row) =>
              !(
                row.roleTypeId === roleTypeId &&
                row.job.listing.id === listingId
              ),
          )
        : rows,
    );
  }

  function openNewSearch(startWithUrl: string | null = null) {
    setCreateDialog({ open: true, startWithUrl });
  }

  function handleCreateDialogOpenChange(open: boolean) {
    setCreateDialog((prev) => ({
      open,
      startWithUrl: open ? prev.startWithUrl : null,
    }));
  }

  function handleDragEnter(e: React.DragEvent) {
    if (!dragPayloadMayContainUrl(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragOver(false);
  }

  function handleDragOver(e: React.DragEvent) {
    if (!dragPayloadMayContainUrl(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOver(false);

    const url = extractHttpsJobUrl(e.dataTransfer);
    if (!url) {
      toast.error("Drop a public https job posting URL");
      return;
    }
    openNewSearch(url);
  }

  async function handleRoleTypeCreated(result: CreatedRoleTypeResult) {
    if (viewAll) {
      router.replace("/dashboard");
    }
    await loadSummaries();
    setSelectedId(result.roleTypeId);
    await loadJobsForRoleType(result.roleTypeId);
    setAllJobsRows(null);
    if (result.highlightJobListingId) {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      setHighlightJobListingId(result.highlightJobListingId);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightJobListingId(null);
        highlightTimeoutRef.current = null;
      }, 5000);
    }
  }

  async function fetchJobs(roleTypeId: string) {
    setFetching(roleTypeId);
    try {
      const res = await api<{
        addedCount: number;
        skippedIrrelevant?: number;
        exhausted: boolean;
        addedJobs?: RoleTypeJobDto[];
      }>(`/api/role-types/${roleTypeId}/find-more`, { method: "POST" });
      if (res.addedCount === 0) {
        const skipped = res.skippedIrrelevant ?? 0;
        if (skipped > 0) {
          toast.message(
            `No new matches (${skipped} role${skipped === 1 ? "" : "s"} skipped as unrelated to this search)`,
          );
        } else {
          toast.message(
            res.exhausted ? "No more results" : "Nothing new this round",
          );
        }
      } else {
        const skipped = res.skippedIrrelevant ?? 0;
        const suffix =
          skipped > 0 ? ` (${skipped} unrelated skipped)` : "";
        toast.success(
          `Added ${res.addedCount} new job${res.addedCount === 1 ? "" : "s"}${suffix}`,
        );
      }

      if (res.addedJobs?.length) {
        setJobsByRoleTypeId((prev) => {
          const existing = prev[roleTypeId] ?? [];
          const nextJobs = mergeJobs(existing, res.addedJobs!);
          setSummaries((all) =>
            all
              ? all.map((s) =>
                  s.id === roleTypeId ? summaryWithCounts(s, nextJobs) : s,
                )
              : all,
          );
          return { ...prev, [roleTypeId]: nextJobs };
        });
        setAllJobsRows(null);
      }

      void loadSummaries();
    } catch (err) {
      toast.error((err as Error).message || "Fetch failed");
    } finally {
      setFetching(null);
    }
  }

  async function deleteRoleType(roleTypeId: string) {
    if (
      !confirm(
        "Delete this search? Its job listings stay in the database, but the search and its sources are removed.",
      )
    )
      return;
    try {
      await api(`/api/role-types/${roleTypeId}`, { method: "DELETE" });
      toast.success("Deleted");
      setJobsByRoleTypeId((prev) => {
        const next = { ...prev };
        delete next[roleTypeId];
        return next;
      });
      setAllJobsRows(null);
      await loadSummaries();
    } catch (err) {
      toast.error((err as Error).message || "Delete failed");
    }
  }

  async function refreshSourcesAndJobs(roleTypeId: string) {
    await loadSummaries();
    setJobsByRoleTypeId((prev) => {
      const next = { ...prev };
      delete next[roleTypeId];
      return next;
    });
    await loadJobsForRoleType(roleTypeId);
    setAllJobsRows(null);
  }

  const jobsLoadingSelected =
    !viewAll && selectedId != null && jobsLoadingId === selectedId;

  return (
    <>
      <div
        className="relative flex h-full min-h-0 flex-1"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div
            className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/80 border-2 border-dashed border-primary m-2 rounded-lg"
            aria-hidden
          >
            <p className="text-sm font-medium text-center px-6">
              Drop job posting URL to create a search
            </p>
          </div>
        )}
        <div
          className="relative flex h-full min-h-0 shrink-0 flex-col"
          style={{ width: sidebarWidth }}
        >
          <aside className="flex h-full min-h-0 flex-col border-r border-border">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-3">
              <span className="text-sm font-medium">Searches</span>
              <Button size="sm" onClick={() => openNewSearch()}>
                <Plus className="mr-1 size-4" />
                New search
              </Button>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <nav className="p-2 space-y-1">
                {loadingSummaries && (
                  <>
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </>
                )}
                {!loadingSummaries && summaries && summaries.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-4">
                    No searches yet.
                  </p>
                )}
                {summaries?.map((rt) => (
                  <SidebarSearchItem
                    key={rt.id}
                    name={rt.name}
                    count={rt.visibleJobCount}
                    selected={!viewAll && selectedId === rt.id}
                    onSelect={() => {
                      router.replace("/dashboard");
                      setSelectedId(rt.id);
                    }}
                  />
                ))}
              </nav>
            </ScrollArea>
          </aside>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={sidebarWidth}
            aria-valuemin={SIDEBAR_WIDTH_MIN}
            aria-valuemax={SIDEBAR_WIDTH_MAX}
            aria-label="Resize searches sidebar"
            tabIndex={0}
            title="Drag to resize. Double-click to reset. Arrow keys adjust width."
            className="absolute inset-y-0 right-0 z-10 w-3 -translate-x-1/2 cursor-col-resize touch-none bg-transparent hover:bg-border/80 focus-visible:bg-ring focus-visible:outline-none"
            onMouseDown={(event) => {
              event.preventDefault();
              startResize(event.clientX, sidebarWidth);
            }}
            onDoubleClick={resetWidth}
            onKeyDown={onSeparatorKeyDown}
          />
        </div>

        <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          {viewAll && allJobsLoading && (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {viewAll && !allJobsLoading && (
            <div className="flex h-full min-h-0 flex-col">
              <div className="shrink-0 border-b border-border p-4">
                <h2 className="text-xl font-semibold tracking-tight">All Jobs</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Every job across your searches. Favorites first, then most
                  recently added.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {allVisibleJobs.length} visible
                  {allHiddenJobs.length > 0
                    ? ` · ${allHiddenJobs.length} hidden`
                    : ""}
                </p>
              </div>
              <div
                ref={allJobsScrollRef}
                className="min-h-0 flex-1 overflow-auto"
              >
                <div className="p-4 w-full min-w-0">
                  {(allJobsRows?.length ?? 0) === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No jobs yet. Add a search and run{" "}
                      <strong>Fetch jobs</strong>, or open{" "}
                      <strong>New search</strong>.
                    </p>
                  )}
                  <VirtualJobList
                    scrollRef={allJobsScrollRef}
                    items={allVisibleJobs}
                    getKey={({ job, roleTypeId }) => `${roleTypeId}-${job.id}`}
                    renderItem={({ job, roleTypeId, roleTypeName }) => (
                      <JobRow
                        roleTypeId={roleTypeId}
                        job={job}
                        searchLabel={`Search: ${roleTypeName}`}
                        roleTypeName={roleTypeName}
                        onChanged={(next) => updateLocalJob(roleTypeId, next)}
                        onRemoved={(listingId) =>
                          removeLocalJob(roleTypeId, listingId)
                        }
                      />
                    )}
                  />

                  {allHiddenJobs.length > 0 && (
                    <div className="pt-4 border-t border-border space-y-3 mt-3">
                      <button
                        type="button"
                        className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
                        onClick={() => setShowHidden((s) => !s)}
                      >
                        {showHidden ? "Hide" : "Show"} {allHiddenJobs.length}{" "}
                        hidden job{allHiddenJobs.length === 1 ? "" : "s"}
                      </button>
                      {showHidden && (
                        <VirtualJobList
                          scrollRef={allJobsScrollRef}
                          items={allHiddenJobs}
                          getKey={({ job, roleTypeId }) =>
                            `${roleTypeId}-${job.id}-hidden`
                          }
                          renderItem={({
                            job,
                            roleTypeId,
                            roleTypeName,
                          }) => (
                            <JobRow
                              roleTypeId={roleTypeId}
                              job={job}
                              searchLabel={`Search: ${roleTypeName}`}
                              roleTypeName={roleTypeName}
                              onChanged={(next) =>
                                updateLocalJob(roleTypeId, next)
                              }
                              onRemoved={(listingId) =>
                                removeLocalJob(roleTypeId, listingId)
                              }
                              showHiddenControls
                            />
                          )}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!viewAll && loadingSummaries && !selectedSummary && (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {!viewAll && !loadingSummaries && !selectedSummary && (
            <div className="p-10 text-center max-w-md mx-auto space-y-3">
              <h2 className="text-lg font-medium">No search selected</h2>
              <p className="text-muted-foreground text-sm">
                Create a search to start aggregating jobs manually, paste a job
                posting URL, or drag a job URL anywhere on this page.
              </p>
              <Button onClick={() => openNewSearch()}>
                <Plus className="mr-1 size-4" />
                New search
              </Button>
            </div>
          )}

          {selectedSummary && !viewAll && (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight truncate">
                    {selectedSummary.name}
                  </h2>
                  {selectedSummary.intent && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {selectedSummary.intent}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedSummary.sources.length} source
                    {selectedSummary.sources.length === 1 ? "" : "s"} ·{" "}
                    {selectedSummary.visibleJobCount} visible job
                    {selectedSummary.visibleJobCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                  <EditRoleTypeDialog
                    key={selectedSummary.id}
                    roleTypeId={selectedSummary.id}
                    initialName={selectedSummary.name}
                    initialIntent={selectedSummary.intent}
                    onSaved={() => void loadSummaries()}
                  />
                  <SourcesSheet
                    roleTypeId={selectedSummary.id}
                    sources={selectedSummary.sources}
                    onChanged={() =>
                      void refreshSourcesAndJobs(selectedSummary.id)
                    }
                    trigger={
                      <Button size="sm" variant="outline" title="Manage sources">
                        <Settings2 className="mr-1 size-4" />
                        Sources
                      </Button>
                    }
                  />
                  <Button
                    size="sm"
                    onClick={() => fetchJobs(selectedSummary.id)}
                    disabled={
                      fetching === selectedSummary.id ||
                      selectedSummary.sources.length === 0
                    }
                    title={
                      selectedSummary.sources.every(
                        (s) => s.paginationState != null,
                      )
                        ? "Fetch the next batch of jobs from where each source left off."
                        : "Fetch jobs from your sources."
                    }
                  >
                    {fetching === selectedSummary.id ? (
                      <Loader2 className="mr-1 size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 size-4" />
                    )}
                    Fetch jobs
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteRoleType(selectedSummary.id)}
                    aria-label="Delete search"
                    title="Delete search"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div ref={mainScrollRef} className="min-h-0 flex-1 overflow-auto">
                <div className="p-4 w-full min-w-0">
                  {jobsLoadingSelected && (
                    <>
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full mt-3" />
                    </>
                  )}
                  {!jobsLoadingSelected && selected && (
                    <>
                      {selected.sources.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No sources on this search yet. Click{" "}
                          <strong>Sources</strong> to add at least one, then{" "}
                          <strong>Fetch jobs</strong>.
                        </p>
                      )}
                      {visibleJobs.length === 0 &&
                        selected.sources.length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            No jobs yet. Click <strong>Fetch jobs</strong> to
                            pull from your sources.
                          </p>
                        )}
                      <VirtualJobList
                        scrollRef={mainScrollRef}
                        items={visibleJobs}
                        getKey={(j) => j.id}
                        renderItem={(j) => (
                          <JobRow
                            roleTypeId={selected.id}
                            job={j}
                            roleTypeName={selected.name}
                            highlighted={
                              highlightJobListingId === j.listing.id
                            }
                            onChanged={(next) =>
                              updateLocalJob(selected.id, next)
                            }
                            onRemoved={(listingId) =>
                              removeLocalJob(selected.id, listingId)
                            }
                          />
                        )}
                      />

                      {hiddenJobs.length > 0 && (
                        <div className="pt-4 border-t border-border space-y-3 mt-3">
                          <button
                            type="button"
                            className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
                            onClick={() => setShowHidden((s) => !s)}
                          >
                            {showHidden ? "Hide" : "Show"} {hiddenJobs.length}{" "}
                            hidden job{hiddenJobs.length === 1 ? "" : "s"}
                          </button>
                          {showHidden && (
                            <VirtualJobList
                              scrollRef={mainScrollRef}
                              items={hiddenJobs}
                              getKey={(j) => `${j.id}-hidden`}
                              renderItem={(j) => (
                                <JobRow
                                  roleTypeId={selected.id}
                                  job={j}
                                  roleTypeName={selected.name}
                                  onChanged={(next) =>
                                    updateLocalJob(selected.id, next)
                                  }
                                  onRemoved={(listingId) =>
                                    removeLocalJob(selected.id, listingId)
                                  }
                                  showHiddenControls
                                />
                              )}
                            />
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <NewRoleTypeDialog
        open={createDialog.open}
        onOpenChange={handleCreateDialogOpenChange}
        startWithUrl={createDialog.startWithUrl}
        onCreated={handleRoleTypeCreated}
      />
    </>
  );
}
