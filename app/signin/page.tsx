import { redirect } from "next/navigation";
import { authSafe, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitHubIcon } from "@/components/icons";

export const metadata = { title: "Sign in — Searcher" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await authSafe();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/dashboard";
  if (session) redirect(callbackUrl);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to Searcher</CardTitle>
          <CardDescription>
            Signing in stores your searches, favorites, and hidden jobs
            against your GitHub account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: callbackUrl });
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              <GitHubIcon className="mr-2 size-4" />
              Continue with GitHub
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
