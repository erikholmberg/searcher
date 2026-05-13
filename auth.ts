import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  session: { strategy: "database" },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
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
