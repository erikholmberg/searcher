import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
  /** Reset each time this module is evaluated (dev HMR) so we can rebuild after `prisma generate`. */
  var __prisma_dev_refresh_once: boolean | undefined;
}

const createClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

function clientHasDismissedModel(c: PrismaClient): boolean {
  return (
    typeof (c as unknown as { roleTypeDismissedJob?: unknown })
      .roleTypeDismissedJob !== "undefined"
  );
}

function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    globalThis.__prisma ??= createClient();
    return globalThis.__prisma;
  }

  let p = globalThis.__prisma;
  if (p && clientHasDismissedModel(p)) return p;

  if (p && !clientHasDismissedModel(p) && !globalThis.__prisma_dev_refresh_once) {
    globalThis.__prisma_dev_refresh_once = true;
    void p.$disconnect().catch(() => {});
    globalThis.__prisma = undefined;
    p = undefined;
  }

  p = globalThis.__prisma ?? createClient();
  if (!clientHasDismissedModel(p) && process.env.NODE_ENV === "development") {
    console.warn(
      "[prisma] Client is missing `roleTypeDismissedJob`. Run `npx prisma generate`, then restart `npm run dev` if this persists.",
    );
  }
  globalThis.__prisma = p;
  return p;
}

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma_dev_refresh_once = false;
}

/**
 * Lazy proxy so dev picks up a new `PrismaClient` after `prisma generate` without requiring
 * a full process restart (the old global singleton lacked new delegates like `roleTypeDismissedJob`).
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver) as unknown;
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
