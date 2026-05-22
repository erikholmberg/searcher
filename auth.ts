import NextAuth from "next-auth";
import type { Session } from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

/**
 * JWT session strategy: the signed session JWT is the source of truth for
 * `session.user.id`, so per-request session lookups (e.g. every API route)
 * don't hit the database. The adapter still owns user / account / OAuth
 * persistence — only the per-request `Session` lookup is short-circuited.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  // Persist githubId after adapter create/link (callbacks.signIn runs too early for new users).
  events: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "github" || !profile || !user.id) return;
      const pid = profile as { id?: string | number | null };
      const githubId =
        typeof pid.id === "string"
          ? pid.id
          : pid.id != null
            ? String(pid.id)
            : null;
      if (!githubId) return;
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { githubId },
        });
      } catch {
        // Non-fatal: user/session already committed; avoid blocking sign-in.
      }
    },
  },
});

function isNextDynamicServerUsage(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    (err as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE"
  );
}

/**
 * Like `auth()`, but never throws for real failures: misconfigured env or DB errors
 * surface as `null` so public routes can still render (OAuth still needs a working setup).
 * Next.js “static vs dynamic” signals are rethrown so the framework can opt into dynamic rendering.
 */
export async function authSafe(): Promise<Session | null> {
  try {
    return await auth();
  } catch (err) {
    if (isNextDynamicServerUsage(err)) throw err;
    console.error("[auth] session lookup failed:", err);
    return null;
  }
}

// Augment Session type for `session.user.id`.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
