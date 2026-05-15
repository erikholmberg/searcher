import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Dashboard — Searcher" };

function DashboardFallback() {
  return (
    <div className="flex flex-1 min-h-[calc(100vh-3.25rem)]">
      <aside className="w-64 shrink-0 border-r border-border p-3 space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </aside>
      <main className="flex-1 p-6 space-y-3">
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
