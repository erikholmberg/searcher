import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { AccountMenu } from "@/components/account-menu";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/signin");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Searcher
          </Link>
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
              All jobs
            </Link>
          </nav>
        </div>
        <AccountMenu
          name={session.user?.name}
          email={session.user?.email}
          image={session.user?.image}
        />
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
