"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

function navLinkClass(active: boolean) {
  return cn(
    "transition-colors",
    active
      ? "font-medium text-foreground"
      : "text-muted-foreground hover:text-foreground",
  );
}

export function DashboardNav() {
  const searchParams = useSearchParams();
  const viewAll = searchParams.get("view") === "all";

  return (
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/dashboard" className={navLinkClass(!viewAll)}>
        Searches
      </Link>
      <Link href="/dashboard?view=all" className={navLinkClass(viewAll)}>
        All Jobs
      </Link>
    </nav>
  );
}
