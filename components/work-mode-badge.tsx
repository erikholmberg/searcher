import { Badge } from "@/components/ui/badge";
import { WorkMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABELS: Record<WorkMode, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "Onsite",
  unknown: "Unknown",
};

export function WorkModeBadge({ mode }: { mode: WorkMode }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs",
        mode === "remote" && "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-300",
        mode === "hybrid" && "bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-300",
        mode === "onsite" && "bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-300",
        mode === "unknown" && "text-muted-foreground",
      )}
    >
      {LABELS[mode]}
    </Badge>
  );
}
