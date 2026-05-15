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
import { Plus, Sparkles } from "lucide-react";

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
  proposal: {
    name: string;
    intent: string;
    sources: SourceDraft[];
  };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set on open, switches to the URL tab and runs suggest once. */
  startWithUrl?: string | null;
  onCreated: () => void;
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
      await api("/api/role-types", {
        method: "POST",
        body: JSON.stringify({
          name: resolvedName,
          intent: resolvedIntent || undefined,
          sources: resolvedSources,
          seedListing: suggestion?.seedListing ?? undefined,
        }),
      });
      toast.success(
        suggestion?.seedListing
          ? `Created "${resolvedName}" with the inspiration job`
          : `Created "${resolvedName}"`,
      );
      handleOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error((err as Error).message || "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New search</DialogTitle>
          <DialogDescription>
            A saved search for similar roles. Add sources (public APIs or career
            pages) now, or after creating.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "manual" | "url")}>
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

          <TabsContent value="url" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="job-url">Job posting URL</Label>
              <Input
                id="job-url"
                placeholder="https://… (any public job posting page, https only)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Paste a public https job URL, or drag one onto the dashboard.
                Creates one source from that URL (Greenhouse/Lever board or public
                job page). AI proposes the search name and intent only.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleSuggest}
              disabled={suggestLoading || !url.trim()}
            >
              <Sparkles className="mr-1 size-4" />
              {suggestLoading ? "Reading…" : "Suggest with AI"}
            </Button>

            {suggestion && (
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
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreate}
                    disabled={submitting}
                  >
                    {submitting ? "Creating…" : "Create search"}
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
                  Creates the search with that URL as its source and attaches
                  this job listing.
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