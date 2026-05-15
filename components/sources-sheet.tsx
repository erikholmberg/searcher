"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  SourceFormFields,
  SourceDraft,
  sourceDraftToInput,
} from "@/components/source-form";
import { api } from "@/lib/api-client";
import { RoleTypeSourceDto, SourceKindString } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

function sourceToDraft(s: RoleTypeSourceDto): SourceDraft {
  const cfg = s.config as Record<string, unknown> | undefined;
  if (s.kind === "public_job_posting") {
    return {
      kind: s.kind,
      postingUrl: (cfg?.url as string) ?? "",
    };
  }
  if (s.kind.endsWith("_board")) {
    return {
      kind: s.kind,
      boardToken: (cfg?.boardToken as string) ?? "",
      extraKeywords: (cfg?.extraKeywords as string) ?? "",
    };
  }
  return {
    kind: s.kind,
    keywords: (cfg?.keywords as string) ?? "",
    location: (cfg?.location as string) ?? "",
    country: (cfg?.country as string) ?? "",
    remoteOnly: (cfg?.remoteOnly as boolean) ?? false,
  };
}

interface Props {
  roleTypeId: string;
  sources: RoleTypeSourceDto[];
  trigger: React.ReactNode;
  onChanged: () => void;
}

export function SourcesSheet({
  roleTypeId,
  sources,
  trigger,
  onChanged,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [drafts, setDrafts] = React.useState<
    Array<{ existingId: string | null; draft: SourceDraft }>
  >([]);
  const [saving, setSaving] = React.useState(false);

  const originalById = React.useMemo(() => {
    return new Map(
      sources.map((s) => [
        s.id,
        {
          kind: s.kind,
          config: s.config,
        },
      ]),
    );
  }, [sources]);

  function deepEqual(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true;
    if (typeof a !== typeof b) return false;
    if (a == null || b == null) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, i) => deepEqual(item, b[i]));
    }
    if (
      typeof a === "object" &&
      typeof b === "object" &&
      !Array.isArray(a) &&
      !Array.isArray(b)
    ) {
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      const aKeys = Object.keys(aObj);
      const bKeys = Object.keys(bObj);
      if (aKeys.length !== bKeys.length) return false;
      return aKeys.every((k) => deepEqual(aObj[k], bObj[k]));
    }
    return false;
  }

  React.useEffect(() => {
    if (open) {
      // Hydrate draft state when the sheet opens; safe because it only fires
      // on the open transition.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDrafts(
        sources.map((s) => ({ existingId: s.id, draft: sourceToDraft(s) })),
      );
    }
  }, [open, sources]);

  function addDraft() {
    setDrafts((d) => [
      ...d,
      {
        existingId: null,
        draft: { kind: "arbeitnow_query" as SourceKindString, keywords: "" },
      },
    ]);
  }

  async function deleteExisting(sourceId: string) {
    try {
      await api(`/api/role-types/${roleTypeId}/sources/${sourceId}`, {
        method: "DELETE",
      });
      toast.success("Source removed");
      setDrafts((d) => d.filter((x) => x.existingId !== sourceId));
      onChanged();
    } catch (err) {
      toast.error((err as Error).message || "Failed to remove");
    }
  }

  async function save() {
    setSaving(true);
    try {
      for (const item of drafts) {
        const input = sourceDraftToInput(item.draft);
        if (item.existingId) {
          const original = originalById.get(item.existingId);
          if (original) {
            const kindChanged = original.kind !== input.kind;
            const configChanged = !deepEqual(original.config, input.config);

            // Existing endpoint only updates config; if kind changes, replace source.
            if (kindChanged) {
              await api(`/api/role-types/${roleTypeId}/sources`, {
                method: "POST",
                body: JSON.stringify(input),
              });
              await api(`/api/role-types/${roleTypeId}/sources/${item.existingId}`, {
                method: "DELETE",
              });
              continue;
            }

            // Avoid no-op PATCH calls that would reset pagination state.
            if (!configChanged) {
              continue;
            }
          }

          await api(`/api/role-types/${roleTypeId}/sources/${item.existingId}`, {
            method: "PATCH",
            body: JSON.stringify({ config: input.config }),
          });
        } else {
          await api(`/api/role-types/${roleTypeId}/sources`, {
            method: "POST",
            body: JSON.stringify(input),
          });
        }
      }
      toast.success("Sources saved");
      setOpen(false);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger as React.ReactElement} />
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Manage sources</SheetTitle>
          <SheetDescription>
            Each source pulls jobs from one provider. Saving here keeps existing
            jobs; click <strong>Refresh</strong> on this search to re-sync.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 py-4">
          {drafts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No sources yet. Click <strong>Add source</strong> below.
            </p>
          )}
          {drafts.map((item, i) => (
            <div key={i} className="space-y-2">
              <SourceFormFields
                index={i}
                value={item.draft}
                onChange={(next) =>
                  setDrafts((all) =>
                    all.map((x, idx) =>
                      idx === i ? { ...x, draft: next } : x,
                    ),
                  )
                }
                onRemove={() => {
                  if (item.existingId) {
                    deleteExisting(item.existingId);
                  } else {
                    setDrafts((all) => all.filter((_, idx) => idx !== i));
                  }
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addDraft}
          >
            <Plus className="mr-1 size-4" />
            Add source
          </Button>
        </div>

        <SheetFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export { Trash2 };
