"use client";

import * as React from "react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { JobRow } from "@/components/job-row";
import { NewRoleTypeDialog } from "@/components/new-role-type-dialog";
import { EditRoleTypeDialog } from "@/components/edit-role-type-dialog";
import { SourcesSheet } from "@/components/sources-sheet";
import { api } from "@/lib/api-client";
import { RoleTypeDto, RoleTypeJobDto } from "@/lib/types";
import { Loader2, Plus, RefreshCw, Search, Settings2, Trash2 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { compareRoleTypeJobs } from "@/lib/compare-role-type-job";
import {
  dragPayloadMayContainUrl,
  extractHttpsJobUrl,
} from "@/lib/url-from-drop";

export function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewAll = searchParams.get("view") === "all";
  const [roleTypes, setRoleTypes] = React.useState<RoleTypeDto[] | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState<string | null>(null);
  const [findingMore, setFindingMore] = React.useState<string | null>(null);
  const [showHidden, setShowHidden] = React.useState(false);
  const [createDialog, setCreateDialog] = React.useState<{
    open: boolean;
    startWithUrl: string | null;
  }>({ open: false, startWithUrl: null });
  const [isDragOver, setIsDragOver] = React.useState(false);
  const dragDepthRef = React.useRef(0);

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

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ roleTypes: RoleTypeDto[] }>("/api/role-types");
      setRoleTypes(res.roleTypes);
      setSelectedId((prev) => {
        if (prev && res.roleTypes.find((rt) => rt.id === prev)) return prev;
        return res.roleTypes[0]?.id ?? null;
      });
    } catch (err) {
      toast.error((err as Error).message || "Failed to load searches");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // Initial fetch on mount; load() is stable thanks to useCallback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const selected = roleTypes?.find((rt) => rt.id === selectedId) ?? null;
  const visibleJobs = selected?.jobs.filter((j) => !j.hidden) ?? [];
  const hiddenJobs = selected?.jobs.filter((j) => j.hidden) ?? [];

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

  async function refresh(roleTypeId: string) {
    setRefreshing(roleTypeId);
    try {
      const res = await api<{ addedCount: number; exhausted: boolean }>(
        `/api/role-types/${roleTypeId}/refresh`,
        { method: "POST" },
      );
      toast.success(`Refreshed (+${res.addedCount} new)`);
      await load();
    } catch (err) {
      toast.error((err as Error).message || "Refresh failed");
    } finally {
      setRefreshing(null);
    }
  }

  async function findMore(roleTypeId: string) {
    setFindingMore(roleTypeId);
    try {
      const res = await api<{ addedCount: number; exhausted: boolean }>(
        `/api/role-types/${roleTypeId}/find-more`,
        { method: "POST" },
      );
      if (res.addedCount === 0) {
        toast.message(res.exhausted ? "No more results" : "Nothing new");
      } else {
        toast.success(`Added ${res.addedCount} new`);
      }
      await load();
    } catch (err) {
      toast.error((err as Error).message || "Find more failed");
    } finally {
      setFindingMore(null);
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
        className="relative flex flex-1 min-h-[calc(100vh-3.25rem)]"
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
      <aside className="w-64 shrink-0 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Searches</span>
          <Button size="sm" onClick={() => openNewSearch()}>
            <Plus className="mr-1 size-4" />
            New search
          </Button>
        </div>
        <ScrollArea className="flex-1">
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
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => {
                    router.replace("/dashboard");
                    setSelectedId(rt.id);
                  }}
                  className={cn(
                    "w-full text-left text-sm px-2 py-1.5 rounded-md flex items-center justify-between gap-2 hover:bg-muted",
                    !viewAll && selectedId === rt.id && "bg-muted",
                  )}
                >
                  <span className="truncate">{rt.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {visibleCount}
                  </Badge>
                </button>
              );
            })}
          </nav>
        </ScrollArea>
      </aside>

      <main className="flex-1 min-w-0">
        {viewAll && loading && (
          <div className="p-6 space-y-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {viewAll && !loading && (
          <div className="flex flex-col h-full">
            <div className="border-b border-border p-4">
              <h2 className="text-xl font-semibold tracking-tight">All jobs</h2>
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
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3 w-full min-w-0">
                {allJobsFlat.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No jobs yet. Add a search and run <strong>Refresh</strong>,
                    or open <strong>New search</strong>.
                  </p>
                )}
                {allVisibleJobs.map(({ job, roleTypeId, roleTypeName }) => (
                  <JobRow
                    key={`${roleTypeId}-${job.id}`}
                    roleTypeId={roleTypeId}
                    job={job}
                    searchLabel={`Search: ${roleTypeName}`}
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
                      allHiddenJobs.map(({ job, roleTypeId, roleTypeName }) => (
                        <JobRow
                          key={`${roleTypeId}-${job.id}-hidden`}
                          roleTypeId={roleTypeId}
                          job={job}
                          searchLabel={`Search: ${roleTypeName}`}
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
          <div className="flex flex-col h-full">
            <div className="border-b border-border p-4 flex items-start justify-between gap-3">
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
                  variant="outline"
                  onClick={() => refresh(selected.id)}
                  disabled={
                    refreshing === selected.id || selected.sources.length === 0
                  }
                  title="Re-sync from the start of each source (for Greenhouse/Lever/Remotive, loads every chunk in one go)"
                >
                  {refreshing === selected.id ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 size-4" />
                  )}
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={() => findMore(selected.id)}
                  disabled={
                    findingMore === selected.id || selected.sources.length === 0
                  }
                  title="Fetch the next page or chunk from each source"
                >
                  {findingMore === selected.id ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <Search className="mr-1 size-4" />
                  )}
                  Find more
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

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3 w-full min-w-0">
                {selected.sources.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No sources on this search yet. Click{" "}
                    <strong>Sources</strong> to add at least one, then{" "}
                    <strong>Refresh</strong>.
                  </p>
                )}
                {visibleJobs.length === 0 && selected.sources.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    No jobs yet. Click <strong>Refresh</strong> to fetch.
                  </p>
                )}
                {visibleJobs.map((j) => (
                  <JobRow
                    key={j.id}
                    roleTypeId={selected.id}
                    job={j}
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
        onCreated={load}
      />
    </>
  );
}
