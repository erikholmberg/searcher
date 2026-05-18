import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Dashboard — Searcher" };

function DashboardFallback() {
  return (
    <div className="flex h-full min-h-0 flex-1">
      <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border p-3 space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </aside>
      <main className="flex min-h-0 flex-1 flex-col p-6 space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <Dashboard />
    </Suspense>
  );
}
