import { NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const BUCKETS = new Map<string, Bucket>();
const GC_INTERVAL_MS = 60_000;
let lastGcAt = 0;

function maybeGc(now: number) {
  if (now - lastGcAt < GC_INTERVAL_MS) return;
  lastGcAt = now;
  for (const [key, bucket] of BUCKETS) {
    if (bucket.resetAt <= now) {
      BUCKETS.delete(key);
    }
  }
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get("x-real-ip")?.trim();
  return xri || "unknown";
}

export function enforceRateLimit(
  req: Request,
  config: {
    scope: string;
    userId: string;
    limit: number;
    windowMs: number;
  },
): NextResponse | null {
  const now = Date.now();
  maybeGc(now);

  const key = `${config.scope}:${config.userId}:${clientIp(req)}`;
  const existing = BUCKETS.get(key);
  if (!existing || existing.resetAt <= now) {
    BUCKETS.set(key, { count: 1, resetAt: now + config.windowMs });
    return null;
  }

  if (existing.count >= config.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000),
    );
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please wait and try again.",
        retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    );
  }

  existing.count += 1;
  return null;
}

