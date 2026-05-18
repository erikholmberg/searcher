import { redirect } from "next/navigation";
import Link from "next/link";
import { authSafe } from "@/auth";
import { AccountMenu } from "@/components/account-menu";

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
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Searches
            </Link>
            <Link
              href="/dashboard?view=all"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              All Jobs
            </Link>
          </nav>
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
