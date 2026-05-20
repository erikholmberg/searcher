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
import { api } from "@/lib/api-client";
import { RoleTypeDto, RoleTypeJobDto } from "@/lib/types";
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

export function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewAll = searchParams.get("view") === "all";
  const [roleTypes, setRoleTypes] = React.useState<RoleTypeDto[] | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
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
  const { width: sidebarWidth, startResize, resetWidth, onSeparatorKeyDown } =
    useResizableSidebarWidth();

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

  const load = React.useCallback(
    async (options?: { selectRoleTypeId?: string }) => {
      setLoading(true);
      try {
        const res = await api<{ roleTypes: RoleTypeDto[] }>("/api/role-types");
        setRoleTypes(res.roleTypes);
        setSelectedId((prev) => {
          if (options?.selectRoleTypeId) {
            const exists = res.roleTypes.find(
              (rt) => rt.id === options.selectRoleTypeId,
            );
            if (exists) return options.selectRoleTypeId;
          }
          if (prev && res.roleTypes.find((rt) => rt.id === prev)) return prev;
          return res.roleTypes[0]?.id ?? null;
        });
      } catch (err) {
        toast.error((err as Error).message || "Failed to load searches");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  async function handleRoleTypeCreated(result: CreatedRoleTypeResult) {
    if (viewAll) {
      router.replace("/dashboard");
    }
    await load({ selectRoleTypeId: result.roleTypeId });
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

  React.useEffect(() => {
    // Initial fetch on mount; load() is stable thanks to useCallback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const selected = roleTypes?.find((rt) => rt.id === selectedId) ?? null;
  const visibleJobs = selected?.jobs.filter((j) => !j.hidden) ?? [];
  const hiddenJobs = selected?.jobs.filter((j) => j.hidden) ?? [];

  React.useEffect(() => {
    if (!highlightJobListingId || viewAll || !selected) return;
    const el = document.getElementById(`job-listing-${highlightJobListingId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightJobListingId, viewAll, selected, visibleJobs.length]);

  const allJobsFlat = React.useMemo(() => {
    if (!roleTypes) return [];
    const rows: Array<{
      job: RoleTypeJobDto;
      roleTypeId: string;
      roleTypeName: string;
    }> = [];
    for (const rt of roleTypes) {
      for (const j of rt.jobs) {
        rows.push({
          job: j,
          roleTypeId: rt.id,
          roleTypeName: rt.name,
        });
      }
    }
    rows.sort((a, b) => compareRoleTypeJobs(a.job, b.job));
    return rows;
  }, [roleTypes]);

  const allVisibleJobs = allJobsFlat.filter(({ job }) => !job.hidden);
  const allHiddenJobs = allJobsFlat.filter(({ job }) => job.hidden);

  function updateLocalJob(roleTypeId: string, next: RoleTypeJobDto) {
    setRoleTypes((all) =>
      all
        ? all.map((rt) =>
            rt.id === roleTypeId
              ? {
                  ...rt,
                  jobs: rt.jobs
                    .map((j) =>
                      j.listing.id === next.listing.id ? next : j,
                    )
                    .sort(compareRoleTypeJobs),
                }
              : rt,
          )
        : all,
    );
  }

  function removeLocalJob(roleTypeId: string, listingId: string) {
    setRoleTypes((all) =>
      all
        ? all.map((rt) =>
            rt.id === roleTypeId
              ? {
                  ...rt,
                  jobs: rt.jobs.filter((j) => j.listing.id !== listingId),
                }
              : rt,
          )
        : all,
    );
  }

  async function fetchJobs(roleTypeId: string) {
    setFetching(roleTypeId);
    try {
      const res = await api<{
        addedCount: number;
        skippedIrrelevant?: number;
        exhausted: boolean;
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
          skipped > 0
            ? ` (${skipped} unrelated skipped)`
            : "";
        toast.success(
          `Added ${res.addedCount} new job${res.addedCount === 1 ? "" : "s"}${suffix}`,
        );
      }
      await load();
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
      await load();
    } catch (err) {
      toast.error((err as Error).message || "Delete failed");
    }
  }

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
              {loading && (
                <>
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </>
              )}
              {!loading && roleTypes && roleTypes.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-4">
                  No searches yet.
                </p>
              )}
              {roleTypes?.map((rt) => {
                const visibleCount = rt.jobs.filter((j) => !j.hidden).length;
                return (
                  <SidebarSearchItem
                    key={rt.id}
                    name={rt.name}
                    count={visibleCount}
                    selected={!viewAll && selectedId === rt.id}
                    onSelect={() => {
                      router.replace("/dashboard");
                      setSelectedId(rt.id);
                    }}
                  />
                );
              })}
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
        {viewAll && loading && (
          <div className="p-6 space-y-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {viewAll && !loading && (
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
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-4 space-y-3 w-full min-w-0">
                {allJobsFlat.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No jobs yet. Add a search and run <strong>Refresh</strong>,
                    or open <strong>New search</strong>.
                  </p>
                )}
                {allVisibleJobs.map(
                  ({ job, roleTypeId, roleTypeName }) => (
                  <JobRow
                    key={`${roleTypeId}-${job.id}`}
                    roleTypeId={roleTypeId}
                    job={job}
                    searchLabel={`Search: ${roleTypeName}`}
                    roleTypeName={roleTypeName}
                    onChanged={(next) => updateLocalJob(roleTypeId, next)}
                    onRemoved={(listingId) =>
                      removeLocalJob(roleTypeId, listingId)
                    }
                  />
                ))}

                {allHiddenJobs.length > 0 && (
                  <div className="pt-4 border-t border-border space-y-3">
                    <button
                      type="button"
                      className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
                      onClick={() => setShowHidden((s) => !s)}
                    >
                      {showHidden ? "Hide" : "Show"} {allHiddenJobs.length}{" "}
                      hidden job{allHiddenJobs.length === 1 ? "" : "s"}
                    </button>
                    {showHidden &&
                      allHiddenJobs.map(
                        ({ job, roleTypeId, roleTypeName }) => (
                        <JobRow
                          key={`${roleTypeId}-${job.id}-hidden`}
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
                      ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {!viewAll && loading && !selected && (
          <div className="p-6 space-y-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {!viewAll && !loading && !selected && (
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

        {selected && !viewAll && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight truncate">
                  {selected.name}
                </h2>
                {selected.intent && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {selected.intent}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {selected.sources.length} source
                  {selected.sources.length === 1 ? "" : "s"} ·{" "}
                  {visibleJobs.length} visible job
                  {visibleJobs.length === 1 ? "" : "s"}
                  {hiddenJobs.length > 0 ? ` · ${hiddenJobs.length} hidden` : ""}
                </p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                <EditRoleTypeDialog
                  key={selected.id}
                  roleTypeId={selected.id}
                  initialName={selected.name}
                  initialIntent={selected.intent}
                  onSaved={load}
                  disabled={loading}
                />
                <SourcesSheet
                  roleTypeId={selected.id}
                  sources={selected.sources}
                  onChanged={load}
                  trigger={
                    <Button size="sm" variant="outline" title="Manage sources">
                      <Settings2 className="mr-1 size-4" />
                      Sources
                    </Button>
                  }
                />
                <Button
                  size="sm"
                  onClick={() => fetchJobs(selected.id)}
                  disabled={
                    fetching === selected.id || selected.sources.length === 0
                  }
                  title={
                    selected.sources.every((s) => s.paginationState != null)
                      ? "Fetch the next batch of jobs from where each source left off. When a source is exhausted, no more jobs are available from it until you re-sync via Sources."
                      : "Fetch jobs from your sources. For job boards (Greenhouse, Lever, Ashby), loads the full board in one go. For aggregators (Arbeitnow, Adzuna), loads the first page — fetch again to get the next."
                  }
                >
                  {fetching === selected.id ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 size-4" />
                  )}
                  Fetch jobs
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteRoleType(selected.id)}
                  aria-label="Delete search"
                  title="Delete search"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="p-4 space-y-3 w-full min-w-0">
                {selected.sources.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No sources on this search yet. Click{" "}
                    <strong>Sources</strong> to add at least one, then{" "}
                    <strong>Fetch jobs</strong>.
                  </p>
                )}
                {visibleJobs.length === 0 && selected.sources.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    No jobs yet. Click <strong>Fetch jobs</strong> to pull from your sources.
                  </p>
                )}
                {visibleJobs.map((j) => (
                  <JobRow
                    key={j.id}
                    roleTypeId={selected.id}
                    job={j}
                    roleTypeName={selected.name}
                    highlighted={highlightJobListingId === j.listing.id}
                    onChanged={(next) => updateLocalJob(selected.id, next)}
                    onRemoved={(listingId) =>
                      removeLocalJob(selected.id, listingId)
                    }
                  />
                ))}

                {hiddenJobs.length > 0 && (
                  <div className="pt-4 border-t border-border space-y-3">
                    <button
                      type="button"
                      className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
                      onClick={() => setShowHidden((s) => !s)}
                    >
                      {showHidden ? "Hide" : "Show"} {hiddenJobs.length}{" "}
                      hidden job{hiddenJobs.length === 1 ? "" : "s"}
                    </button>
                    {showHidden &&
                      hiddenJobs.map((j) => (
                        <JobRow
                          key={j.id}
                          roleTypeId={selected.id}
                          job={j}
                          roleTypeName={selected.name}
                          onChanged={(next) => updateLocalJob(selected.id, next)}
                          onRemoved={(listingId) =>
                            removeLocalJob(selected.id, listingId)
                          }
                          showHiddenControls
                        />
                      ))}
                  </div>
                )}
              </div>
            </ScrollArea>
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
