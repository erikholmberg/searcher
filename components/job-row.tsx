"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WorkModeBadge } from "@/components/work-mode-badge";
import { api } from "@/lib/api-client";
import { JOB_STATUS_OPTIONS, RoleTypeJobDto } from "@/lib/types";
import { Star, EyeOff, ExternalLink, Undo2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobFitSummary } from "@/components/job-fit-summary";
import { JobDescriptionSnippet } from "@/components/job-description-snippet";

interface Props {
  job: RoleTypeJobDto;
  roleTypeId: string;
  onChanged: (job: RoleTypeJobDto) => void;
  onRemoved: (listingId: string) => void;
  showHiddenControls?: boolean;
  searchLabel?: string;
  roleTypeName?: string;
  highlighted?: boolean;
}

export function JobRow({
  job,
  roleTypeId,
  onChanged,
  onRemoved,
  showHiddenControls = false,
  searchLabel,
  roleTypeName,
  highlighted = false,
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const [showNotes, setShowNotes] = React.useState(
    !!job.notes && job.notes.trim().length > 0,
  );
  const notesTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  async function patch(state: {
    favorite?: boolean;
    hidden?: boolean;
    status?: RoleTypeJobDto["status"];
    notes?: string | null;
  }) {
    const next: RoleTypeJobDto = {
      ...job,
      favorite: state.favorite ?? job.favorite,
      hidden: state.hidden ?? job.hidden,
      status: state.status ?? job.status,
      notes: state.notes !== undefined ? state.notes : job.notes,
    };
    onChanged(next);
    setBusy(true);
    try {
      await api(`/api/jobs/${job.listing.id}/state`, {
        method: "PATCH",
        body: JSON.stringify(state),
      });
    } catch (err) {
      onChanged(job);
      toast.error((err as Error).message || "Update failed");
    } finally {
      setBusy(false);
    }
  }

  function handleNotesChange(value: string) {
    if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current);
    notesTimeoutRef.current = setTimeout(() => {
      void patch({ notes: value || null });
    }, 800);
  }

  async function removeFromList() {
    if (
      !confirm(
        "Remove this job from this list? It will not reappear after Fetch jobs.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await api(`/api/role-types/${roleTypeId}/jobs/${job.listing.id}`, {
        method: "DELETE",
      });
      onRemoved(job.listing.id);
      toast.success("Job removed");
    } catch (err) {
      toast.error((err as Error).message || "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  const postedLabel = job.listing.postedAt
    ? new Date(job.listing.postedAt).toLocaleDateString()
    : null;
  const addedLabel = new Date(job.addedAt).toLocaleDateString();

  const statusOption = JOB_STATUS_OPTIONS.find((o) => o.value === job.status);

  return (
    <Card
      id={`job-listing-${job.listing.id}`}
      className={cn(
        "p-3 scroll-mt-4 transition-[box-shadow,background-color] duration-500",
        job.favorite && "ring-1 ring-amber-400/60",
        highlighted && "ring-2 ring-primary bg-primary/10 shadow-sm",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={job.listing.url}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium hover:underline truncate"
            >
              {job.listing.title}
            </a>
            <ExternalLink className="size-3 text-muted-foreground shrink-0" />
          </div>
          {searchLabel ? (
            <p className="text-xs text-muted-foreground mt-0.5">{searchLabel}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {job.listing.company}
            {job.listing.locationDisplay
              ? ` · ${job.listing.locationDisplay}`
              : " · Location not listed"}
            {postedLabel ? ` · Posted ${postedLabel}` : ""}
            {` · Added ${addedLabel}`}
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <WorkModeBadge mode={job.listing.workMode} />
            <span className="text-muted-foreground text-xs">
              {job.listing.source}
            </span>
            {/* Status picker */}
            <Select
              value={job.status}
              onValueChange={(val) =>
                void patch({ status: val as RoleTypeJobDto["status"] })
              }
              disabled={busy}
            >
              <SelectTrigger
                className={cn(
                  "h-5 text-xs px-1.5 border-0 bg-transparent shadow-none focus:ring-0 w-auto gap-1",
                  statusOption?.color,
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOB_STATUS_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className={cn("text-xs", opt.color)}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <JobDescriptionSnippet
            initialSnippet={job.listing.descriptionSnippet}
          />
          {roleTypeName ? (
            <JobFitSummary
              roleTypeId={roleTypeId}
              jobListingId={job.listing.id}
            />
          ) : null}

          {/* Notes */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowNotes((s) => !s)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {showNotes ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
              {showNotes ? "Hide notes" : job.notes ? "Notes" : "Add notes"}
            </button>
            {showNotes && (
              <Textarea
                key={job.listing.id}
                className="mt-1.5 text-sm min-h-[72px] resize-y"
                placeholder="Recruiter name, salary range, interview notes…"
                defaultValue={job.notes ?? ""}
                onChange={(e) => handleNotesChange(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          {showHiddenControls ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={busy}
                onClick={() => patch({ hidden: false })}
                aria-label="Unhide"
                title="Unhide"
              >
                <Undo2 className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={busy}
                onClick={() => removeFromList()}
                aria-label="Remove from list"
                title="Remove from list"
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant={job.favorite ? "default" : "outline"}
                size="icon-sm"
                disabled={busy}
                onClick={() => patch({ favorite: !job.favorite })}
                aria-label={job.favorite ? "Unfavorite" : "Favorite"}
                title={job.favorite ? "Unfavorite" : "Favorite"}
              >
                <Star
                  className={cn(
                    "size-4",
                    job.favorite && "fill-current text-amber-400",
                  )}
                />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={busy}
                onClick={() => patch({ hidden: true })}
                aria-label="Hide"
                title="Hide"
              >
                <EyeOff className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={busy}
                onClick={() => removeFromList()}
                aria-label="Remove from list"
                title="Remove from list"
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
