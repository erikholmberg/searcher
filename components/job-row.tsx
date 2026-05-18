"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WorkModeBadge } from "@/components/work-mode-badge";
import { api } from "@/lib/api-client";
import { RoleTypeJobDto } from "@/lib/types";
import { Star, EyeOff, ExternalLink, Undo2, Trash2 } from "lucide-react";
import { stripHtml } from "@/lib/jobs/utils";
import { cn } from "@/lib/utils";

interface Props {
  job: RoleTypeJobDto;
  roleTypeId: string;
  onChanged: (job: RoleTypeJobDto) => void;
  /** Called after the job is removed from this role type (listing id). */
  onRemoved: (listingId: string) => void;
  showHiddenControls?: boolean;
  /** When set (e.g. All jobs view), shown as muted context under the title. */
  searchLabel?: string;
  /** Brief emphasis after creating a search from a job URL. */
  highlighted?: boolean;
}

export function JobRow({
  job,
  roleTypeId,
  onChanged,
  onRemoved,
  showHiddenControls = false,
  searchLabel,
  highlighted = false,
}: Props) {
  const [busy, setBusy] = React.useState(false);

  async function patch(state: { favorite?: boolean; hidden?: boolean }) {
    const next: RoleTypeJobDto = {
      ...job,
      favorite: state.favorite ?? job.favorite,
      hidden: state.hidden ?? job.hidden,
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

  async function removeFromList() {
    if (
      !confirm(
        "Remove this job from this list? It will not reappear after Refresh or Find more.",
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
          </div>
          {job.listing.descriptionSnippet && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-4 break-words">
              {stripHtml(job.listing.descriptionSnippet, 1500)}
            </p>
          )}
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
