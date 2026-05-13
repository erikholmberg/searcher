import Link from "next/link";
import { auth, signIn } from "@/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { GitHubIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-4xl font-semibold tracking-tight">Searcher</h1>
        <p className="text-muted-foreground text-lg">
          Define role types, aggregate jobs from public APIs and career pages,
          favorite the good ones, hide the rest.
        </p>
        <div className="flex justify-center">
          {session ? (
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Open dashboard
            </Link>
          ) : (
            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo: "/dashboard" });
              }}
            >
              <Button type="submit" size="lg">
                <GitHubIcon className="mr-2 size-4" />
                Continue with GitHub
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
