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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SourceFormFields, SourceDraft, sourceDraftToInput } from "@/components/source-form";
import { api } from "@/lib/api-client";
import { Plus, Sparkles } from "lucide-react";

type Suggestion = {
  posting: {
    title: string;
    company: string;
    url: string;
    snippet: string | null;
    locationDisplay: string | null;
    workMode: "remote" | "hybrid" | "onsite" | "unknown";
  };
  proposal: {
    name: string;
    intent: string;
    sources: SourceDraft[];
  };
};

export function NewRoleTypeDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"manual" | "url">("manual");

  // Manual state
  const [name, setName] = React.useState("");
  const [intent, setIntent] = React.useState("");
  const [sources, setSources] = React.useState<SourceDraft[]>([
    { kind: "arbeitnow_query", keywords: "" },
  ]);
  const [submitting, setSubmitting] = React.useState(false);

  // From-URL state
  const [url, setUrl] = React.useState("");
  const [suggestLoading, setSuggestLoading] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<Suggestion | null>(null);

  function reset() {
    setName("");
    setIntent("");
    setSources([{ kind: "arbeitnow_query", keywords: "" }]);
    setUrl("");
    setSuggestion(null);
    setTab("manual");
  }

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
    if (!url.trim()) return;
    setSuggestLoading(true);
    try {
      const res = await api<Suggestion>(
        "/api/role-types/suggest-from-job-url",
        {
          method: "POST",
          body: JSON.stringify({ url: url.trim() }),
        },
      );
      setSuggestion(res);
    } catch (err) {
      toast.error((err as Error).message || "Failed to read URL");
    } finally {
      setSuggestLoading(false);
    }
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      await api("/api/role-types", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          intent: intent.trim() || undefined,
          sources: sources.map(sourceDraftToInput),
        }),
      });
      toast.success(`Created "${name.trim()}"`);
      setOpen(false);
      reset();
      onCreated();
    } catch (err) {
      toast.error((err as Error).message || "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="mr-1 size-4" />
            New role type
          </Button>
        }
      />
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New role type</DialogTitle>
          <DialogDescription>
            A bucket of similar roles. Add sources (public APIs or career pages)
            now, or after creating.
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
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="intent">
                Intent (optional, used by AI fit summaries)
              </Label>
              <Textarea
                id="intent"
                placeholder="What does 'similar' mean for this bucket? Level, stack, domain, etc."
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
                  No sources yet. You can add some later from the role type page.
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
                Paste a public https job URL. Known boards (Greenhouse, Lever,
                Playlist careers) use structured data; other sites use extracted
                page text. Private networks and non-HTML responses are blocked.
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
                    <span className="font-medium">Sources:</span>{" "}
                    {suggestion.proposal.sources.length}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={fillFromSuggestion}
                >
                  Use proposal (edit on Manual tab)
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              reset();
            }}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={submitting}>
            {submitting ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
