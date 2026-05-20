"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SOURCE_KIND_OPTIONS, SourceKindString } from "@/lib/types";
import { Trash2 } from "lucide-react";

export interface SourceDraft {
  kind: SourceKindString;
  // Aggregator
  keywords?: string;
  location?: string;
  country?: string;
  remoteOnly?: boolean;
  // ATS
  boardToken?: string;
  extraKeywords?: string;
  // public_job_posting
  postingUrl?: string;
  // careers_site
  seedUrl?: string;
  listingUrl?: string;
  seedTitle?: string;
  seedExcerpt?: string;
}

interface Props {
  value: SourceDraft;
  onChange: (next: SourceDraft) => void;
  onRemove?: () => void;
  index: number;
}

export function SourceFormFields({ value, onChange, onRemove, index }: Props) {
  const isAts = value.kind.endsWith("_board");
  const isPublicPosting = value.kind === "public_job_posting";
  const isCareersSite = value.kind === "careers_site";
  const id = (field: string) => `source-${index}-${field}`;

  return (
    <div className="border border-border rounded-lg p-3 space-y-3 bg-card">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id("kind")} className="text-xs uppercase tracking-wide">
          Source #{index + 1}
        </Label>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label="Remove source"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("kind")}>Provider</Label>
        <Select
          value={value.kind}
          onValueChange={(v) => {
            if (!v) return;
            const k = v as SourceKindString;
            if (k === "public_job_posting") {
              onChange({ kind: k, postingUrl: "" });
            } else if (k === "careers_site") {
              onChange({ kind: k, seedUrl: "", listingUrl: "" });
            } else if (k.endsWith("_board")) {
              onChange({ kind: k, boardToken: "", extraKeywords: "" });
            } else {
              onChange({
                kind: k,
                keywords: "",
                location: "",
                country: "",
                remoteOnly: false,
              });
            }
          }}
        >
          <SelectTrigger id={id("kind")} className="w-full min-w-0">
            <SelectValue placeholder="Choose provider" />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_KIND_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPublicPosting ? (
        <div className="space-y-1.5">
          <Label htmlFor={id("postingUrl")}>Job posting URL</Label>
          <Input
            id={id("postingUrl")}
            placeholder="https://… (public https job page)"
            value={value.postingUrl ?? ""}
            onChange={(e) => onChange({ ...value, postingUrl: e.target.value })}
          />
          <p className="text-muted-foreground text-xs">
            Same rules as “Suggest from job URL”: https only, server-side fetch
            with SSRF checks. Refresh re-reads the page into this search.
          </p>
        </div>
      ) : isCareersSite ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={id("seedUrl")}>Seed job URL</Label>
            <Input
              id={id("seedUrl")}
              placeholder="https://… (the inspiration posting)"
              value={value.seedUrl ?? ""}
              onChange={(e) => onChange({ ...value, seedUrl: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={id("listingUrl")}>Careers listing URL (optional)</Label>
            <Input
              id={id("listingUrl")}
              placeholder="https://…/careers — auto-detected if empty"
              value={value.listingUrl ?? ""}
              onChange={(e) =>
                onChange({ ...value, listingUrl: e.target.value })
              }
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Refresh discovers same-site job links and ingests roles similar to
            the seed posting.
          </p>
        </>
      ) : isAts ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={id("boardToken")}>Board token / site slug</Label>
            <Input
              id={id("boardToken")}
              placeholder={
                value.kind === "ashby_board"
                  ? "e.g. Ashby (from jobs.ashbyhq.com/Ashby)"
                  : "e.g. stripe (Greenhouse) or notion (Lever)"
              }
              value={value.boardToken ?? ""}
              onChange={(e) => onChange({ ...value, boardToken: e.target.value })}
            />
            <p className="text-muted-foreground text-xs">
              {value.kind === "ashby_board" ? (
                <>
                  From the public board URL (e.g. jobs.ashbyhq.com/
                  <strong>YourOrg</strong>).
                </>
              ) : (
                <>
                  Take it from the public board URL (e.g.
                  boards.greenhouse.io/<strong>stripe</strong>).
                </>
              )}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={id("extraKeywords")}>
              Extra title filter (optional)
            </Label>
            <Input
              id={id("extraKeywords")}
              placeholder="Defaults to your search name if empty"
              value={value.extraKeywords ?? ""}
              onChange={(e) =>
                onChange({ ...value, extraKeywords: e.target.value })
              }
            />
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={id("keywords")}>Keywords</Label>
            <Input
              id={id("keywords")}
              placeholder="e.g. staff backend platform"
              value={value.keywords ?? ""}
              onChange={(e) => onChange({ ...value, keywords: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor={id("location")}>Location</Label>
              <Input
                id={id("location")}
                placeholder="e.g. New York or remote"
                value={value.location ?? ""}
                onChange={(e) =>
                  onChange({ ...value, location: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("country")}>Country (2-letter)</Label>
              <Input
                id={id("country")}
                placeholder="us"
                maxLength={2}
                value={value.country ?? ""}
                onChange={(e) =>
                  onChange({ ...value, country: e.target.value })
                }
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.remoteOnly ?? false}
              onChange={(e) =>
                onChange({ ...value, remoteOnly: e.target.checked })
              }
            />
            Remote only
          </label>
        </>
      )}
    </div>
  );
}

export function sourceDraftToInput(draft: SourceDraft) {
  const isAts = draft.kind.endsWith("_board");
  if (draft.kind === "public_job_posting") {
    return {
      kind: draft.kind,
      config: {
        url: (draft.postingUrl ?? "").trim(),
      },
    };
  }
  if (draft.kind === "careers_site") {
    const listing = (draft.listingUrl ?? "").trim();
    const seedTitle = (draft.seedTitle ?? "").trim();
    const seedExcerpt = (draft.seedExcerpt ?? "").trim();
    return {
      kind: draft.kind,
      config: {
        seedUrl: (draft.seedUrl ?? "").trim(),
        listingUrl: listing || undefined,
        seedTitle: seedTitle || undefined,
        seedExcerpt: seedExcerpt || undefined,
      },
    };
  }
  if (isAts) {
    return {
      kind: draft.kind,
      config: {
        boardToken: (draft.boardToken ?? "").trim(),
        extraKeywords: draft.extraKeywords?.trim() || undefined,
      },
    };
  }
  return {
    kind: draft.kind,
    config: {
      keywords: (draft.keywords ?? "").trim(),
      location: draft.location?.trim() || undefined,
      country: draft.country?.trim()?.toLowerCase() || undefined,
      remoteOnly: draft.remoteOnly ?? undefined,
    },
  };
}
