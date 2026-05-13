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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { Pencil } from "lucide-react";

type Props = {
  roleTypeId: string;
  initialName: string;
  initialIntent: string | null;
  onSaved: () => void;
  disabled?: boolean;
};

export function EditRoleTypeDialog({
  roleTypeId,
  initialName,
  initialIntent,
  onSaved,
  disabled,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(initialName);
  const [intent, setIntent] = React.useState(initialIntent ?? "");
  const [submitting, setSubmitting] = React.useState(false);

  function handleOpenChange(next: boolean) {
    if (next) {
      setName(initialName);
      setIntent(initialIntent ?? "");
    }
    setOpen(next);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      await api(`/api/role-types/${roleTypeId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          intent: intent.trim() ? intent.trim() : null,
        }),
      });
      toast.success("Role type updated");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            title="Edit name and intent"
            disabled={disabled}
          >
            <Pencil className="mr-1 size-4" />
            Edit
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit role type</DialogTitle>
          <DialogDescription>
            Update the display name and intent. Sources are managed separately
            from the Sources button.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-rt-name">Name</Label>
            <Input
              id="edit-rt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-rt-intent">
              Intent (optional, used by AI fit summaries)
            </Label>
            <Textarea
              id="edit-rt-intent"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              rows={4}
              placeholder="What does 'similar' mean for this bucket?"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
