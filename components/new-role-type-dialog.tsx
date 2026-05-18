"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SourceFormFields, SourceDraft, sourceDraftToInput } from "@/components/source-form";
import { api } from "@/lib/api-client";
import { SOURCE_KIND_OPTIONS } from "@/lib/types";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import { JobUrlReadingPanel } from "@/components/job-url-reading-panel";

function describeProposalSource(sources: SourceDraft[]): string {
  const s = sources[0];
  if (!s) return "—";
  return SOURCE_KIND_OPTIONS.find((o) => o.value === s.kind)?.label ?? s.kind;
}

type SeedListing = {
  externalId: string;
  source: string;
  title: string;
  company: string;
  url: string;
  descriptionSnippet: string | null;
  postedAt: string | null;
  locationDisplay: string | null;
  workMode: "remote" | "hybrid" | "onsite" | "unknown";
};

type Suggestion = {
  posting: {
    title: string;
    company: string;
    url: string;
    snippet: string | null;
    locationDisplay: string | null;
    workMode: "remote" | "hybrid" | "onsite" | "unknown";
  };
  seedListing: SeedListing;
  discovery: { listingUrl: string; candidateCount: number } | null;
  proposal: {
    name: string;
    intent: string;
    sources: SourceDraft[];
  };
};

export type CreatedRoleTypeResult = {
  roleTypeId: string;
  /** Inspiration job from URL flow; scroll/highlight in the job list. */
  highlightJobListingId?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set on open, switches to the URL tab and runs suggest once. */
  startWithUrl?: string | null;
  onCreated: (result: CreatedRoleTypeResult) => void;
};

export function NewRoleTypeDialog({
  open,
  onOpenChange,
  startWithUrl,
  onCreated,
}: Props) {
  const [tab, setTab] = React.useState<"manual" | "url">("manual");
  const [name, setName] = React.useState("");
  const [intent, setIntent] = React.useState("");
  const [sources, setSources] = React.useState<SourceDraft[]>([
    { kind: "arbeitnow_query", keywords: "" },
  ]);
  const [submitting, setSubmitting] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [suggestLoading, setSuggestLoading] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<Suggestion | null>(null);
  const lastAutoSuggestedRef = React.useRef<string | null>(null);

  function reset() {
    setName("");
    setIntent("");
    setSources([{ kind: "arbeitnow_query", keywords: "" }]);
    setUrl("");
    setSuggestion(null);
    setTab("manual");
    lastAutoSuggestedRef.current = null;
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function runSuggest(urlToSuggest: string) {
    const trimmed = urlToSuggest.trim();
    if (!trimmed) return;
    setSuggestLoading(true);
    setSuggestion(null);
    try {
      const res = await api<Suggestion>(
        "/api/role-types/suggest-from-job-url",
        {
          method: "POST",
          body: JSON.stringify({ url: trimmed }),
        },
      );
      setSuggestion(res);
    } catch (err) {
      toast.error((err as Error).message || "Failed to read URL");
    } finally {
      setSuggestLoading(false);
    }
  }

  React.useEffect(() => {
    if (!open || !startWithUrl?.trim()) return;
    const trimmed = startWithUrl.trim();
    if (lastAutoSuggestedRef.current === trimmed) return;
    lastAutoSuggestedRef.current = trimmed;
    setTab("url");
    setUrl(trimmed);
    void runSuggest(trimmed);
  }, [open, startWithUrl]);

  function fillFromSuggestion() {
    if (!suggestion) return;
    setName(suggestion.proposal.name);
    setIntent(suggestion.proposal.intent);
    setSources(
      suggestion.proposal.sources.length
        ? suggestion.proposal.sources
        : [{ kind: "arbeitnow_query", keywords: "" }],
    );
    setTab("manual");
  }

  async function handleSuggest() {
    await runSuggest(url);
  }

  async function handleCreate() {
    const useProposalFields = suggestion != null && tab === "url";
    const resolvedName = (
      useProposalFields ? suggestion.proposal.name : name
    ).trim();
    const resolvedIntent = (
      useProposalFields ? suggestion.proposal.intent : intent
    ).trim();
    const resolvedSources = (
      useProposalFields ? suggestion.proposal.sources : sources
    ).map(sourceDraftToInput);

    if (!resolvedName) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<{
        roleType: { id: string };
        seedJobListingId?: string;
        ingestSummary?: {
          addedCount: number;
          error?: string;
        } | null;
      }>("/api/role-types", {
        method: "POST",
        body: JSON.stringify({
          name: resolvedName,
          intent: resolvedIntent || undefined,
          sources: resolvedSources,
          seedListing: suggestion?.seedListing ?? undefined,
        }),
      });
      const added = res.ingestSummary?.addedCount ?? 0;
      if (res.ingestSummary?.error) {
        toast.warning(
          `Created "${resolvedName}" but discovery failed: ${res.ingestSummary.error}`,
        );
      } else if (added > 0) {
        toast.success(
          `Created "${resolvedName}" with ${added} similar role${added === 1 ? "" : "s"}`,
        );
      } else if (suggestion?.seedListing) {
        toast.success(
          `Created "${resolvedName}" with the inspiration job`,
        );
      } else {
        toast.success(`Created "${resolvedName}"`);
      }
      handleOpenChange(false);
      onCreated({
        roleTypeId: res.roleType.id,
        highlightJobListingId:
          suggestion?.seedListing && res.seedJobListingId
            ? res.seedJobListingId
            : undefined,
      });
    } catch (err) {
      toast.error((err as Error).message || "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl min-w-0 overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>New search</DialogTitle>
          <DialogDescription>
            A saved search for similar roles. Add sources (public APIs or career
            pages) now, or after creating.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "manual" | "url")}
          className="min-w-0"
        >
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="url">
              <Sparkles className="mr-1 size-3.5" /> From job URL (AI)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g. Staff backend"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus={open && tab === "manual" && !startWithUrl}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="intent">
                Intent (optional, used by AI fit summaries)
              </Label>
              <Textarea
                id="intent"
                placeholder="What does 'similar' mean for this search? Level, stack, domain, etc."
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Sources</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    setSources((s) => [
                      ...s,
                      { kind: "arbeitnow_query", keywords: "" },
                    ])
                  }
                >
                  <Plus className="mr-1 size-3" />
                  Add source
                </Button>
              </div>
              {sources.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No sources yet. You can add some later from the search page.
                </p>
              )}
              {sources.map((s, i) => (
                <SourceFormFields
                  key={i}
                  index={i}
                  value={s}
                  onChange={(next) =>
                    setSources((all) => all.map((x, idx) => (idx === i ? next : x)))
                  }
                  onRemove={
                    sources.length > 1
                      ? () =>
                          setSources((all) =>
                            all.filter((_, idx) => idx !== i),
                          )
                      : undefined
                  }
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="url" className="min-w-0 space-y-4 overflow-x-hidden pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="job-url">Job posting URL</Label>
              <Input
                id="job-url"
                placeholder="https://… (any public job posting page, https only)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={suggestLoading || submitting}
              />
              <p className="text-muted-foreground text-xs">
                Paste a public https job URL, or drag one onto the dashboard.
                Greenhouse/Lever links use the full board; other sites search the
                careers page for similar roles. AI proposes the search name and intent.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleSuggest}
              disabled={suggestLoading || submitting || !url.trim()}
            >
              {suggestLoading ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1 size-4" />
              )}
              {suggestLoading ? "Reading page…" : "Suggest with AI"}
            </Button>

            {suggestLoading && (
              <JobUrlReadingPanel phase="reading" url={url.trim()} />
            )}

            {submitting && suggestion && tab === "url" && (
              <JobUrlReadingPanel phase="discovering" url={url.trim()} />
            )}

            {suggestion && !suggestLoading && (
              <div className="border border-border rounded-lg p-3 text-sm space-y-3">
                <div>
                  <p className="font-medium">{suggestion.posting.title}</p>
                  <p className="text-muted-foreground">
                    {suggestion.posting.company}
                    {suggestion.posting.locationDisplay
                      ? ` · ${suggestion.posting.locationDisplay}`
                      : ""}
                  </p>
                </div>
                <div className="space-y-1 border-t border-border pt-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    AI proposal
                  </p>
                  <p>
                    <span className="font-medium">Name:</span>{" "}
                    {suggestion.proposal.name}
                  </p>
                  <p>
                    <span className="font-medium">Intent:</span>{" "}
                    {suggestion.proposal.intent}
                  </p>
                  <p>
                    <span className="font-medium">Source:</span>{" "}
                    {describeProposalSource(suggestion.proposal.sources)}
                  </p>
                  {suggestion.discovery && (
                    <p>
                      <span className="font-medium">Careers listing:</span>{" "}
                      <span className="break-all text-muted-foreground">
                        {suggestion.discovery.listingUrl}
                      </span>
                      {suggestion.discovery.candidateCount > 0 && (
                        <span className="text-muted-foreground">
                          {" "}
                          (~{suggestion.discovery.candidateCount} links found)
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreate}
                    disabled={submitting}
                  >
                    {submitting ? "Discovering…" : "Create search"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={fillFromSuggestion}
                    disabled={submitting}
                  >
                    Edit on Manual tab
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Creates the search, attaches this job, and discovers similar
                  roles on the same careers site when possible.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          {!(suggestion && tab === "url") && (
            <Button type="button" onClick={handleCreate} disabled={submitting}>
              {submitting ? "Creating…" : "Create"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}