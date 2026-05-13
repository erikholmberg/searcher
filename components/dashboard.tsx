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
import { Loader2, RefreshCw, Search, Settings2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dashboard() {
  const [roleTypes, setRoleTypes] = React.useState<RoleTypeDto[] | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState<string | null>(null);
  const [findingMore, setFindingMore] = React.useState<string | null>(null);
  const [showHidden, setShowHidden] = React.useState(false);

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
      toast.error((err as Error).message || "Failed to load role types");
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

  function updateLocalJob(roleTypeId: string, next: RoleTypeJobDto) {
    setRoleTypes((all) =>
      all
        ? all.map((rt) =>
            rt.id === roleTypeId
              ? {
                  ...rt,
                  jobs: rt.jobs.map((j) =>
                    j.listing.id === next.listing.id ? next : j,
                  ),
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
        "Delete this role type? Its job listings stay in the database, but the bucket and its sources are removed.",
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
    <div className="flex flex-1 min-h-[calc(100vh-3.25rem)]">
      <aside className="w-64 shrink-0 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Role types</span>
          <NewRoleTypeDialog onCreated={load} />
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
                No role types yet.
              </p>
            )}
            {roleTypes?.map((rt) => {
              const visibleCount = rt.jobs.filter((j) => !j.hidden).length;
              return (
                <button
                  key={rt.id}
                  onClick={() => setSelectedId(rt.id)}
                  className={cn(
                    "w-full text-left text-sm px-2 py-1.5 rounded-md flex items-center justify-between gap-2 hover:bg-muted",
                    selectedId === rt.id && "bg-muted",
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
        {loading && !selected && (
          <div className="p-6 space-y-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {!loading && !selected && (
          <div className="p-10 text-center max-w-md mx-auto space-y-3">
            <h2 className="text-lg font-medium">No role type selected</h2>
            <p className="text-muted-foreground text-sm">
              Create a role type to start aggregating jobs. You can do it
              manually or paste a job posting URL and let AI propose one.
            </p>
            <NewRoleTypeDialog onCreated={load} />
          </div>
        )}

        {selected && (
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
                  title="Reset and re-sync the first window of each source"
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
                  aria-label="Delete role type"
                  title="Delete role type"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3 max-w-3xl">
                {selected.sources.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No sources on this role type yet. Click{" "}
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
                    job={j}
                    onChanged={(next) => updateLocalJob(selected.id, next)}
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
                          job={j}
                          onChanged={(next) => updateLocalJob(selected.id, next)}
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
  );
}
