import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authSafe } from "@/auth";
import { AccountMenu } from "@/components/account-menu";
import { DashboardNav } from "@/components/dashboard-nav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await authSafe();
  if (!session) redirect("/signin");

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex shrink-0 z-20 items-center justify-between border-b border-border bg-background px-6 py-3">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          Searcher
        </Link>
        <div className="flex items-center gap-6">
          <Suspense fallback={<nav className="h-5 w-32" aria-hidden />}>
            <DashboardNav />
          </Suspense>
          <AccountMenu
            name={session.user?.name}
            email={session.user?.email}
            image={session.user?.image}
          />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
