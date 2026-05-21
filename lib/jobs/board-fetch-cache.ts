/**
 * In-memory cache for full ATS board API responses within a single ingest run
 * (and briefly across consecutive find-more slices). Avoids re-downloading the
 * entire board on every pagination step.
 */
const TTL_MS = 120_000;

type Entry = { data: unknown; expiresAt: number };

const cache = new Map<string, Entry>();

export function boardFetchCacheKey(
  provider: string,
  boardToken: string,
  extraKeywords: string | undefined | null,
): string {
  const filter = extraKeywords?.toLowerCase().trim() ?? "";
  return `${provider}:${boardToken}:${filter}`;
}

export function getBoardFetchCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function setBoardFetchCache(key: string, data: unknown): void {
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

export function clearBoardFetchCache(): void {
  cache.clear();
}
