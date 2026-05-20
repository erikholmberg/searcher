const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "your",
  "our",
  "this",
  "that",
  "role",
  "roles",
  "job",
  "jobs",
  "position",
  "positions",
]);

const BOARD_KINDS = new Set([
  "greenhouse_board",
  "lever_board",
  "ashby_board",
]);

function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of raw) {
    if (w.length < 3 || STOPWORDS.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

/** Significant tokens from search name and optional intent. */
export function extractSearchTokens(
  name: string,
  intent?: string | null,
): string[] {
  return tokenize([name, intent ?? ""].filter(Boolean).join(" "));
}

function requiredTokenMatches(tokenCount: number): number {
  if (tokenCount <= 1) return 1;
  if (tokenCount <= 4) return 2;
  return Math.max(2, Math.ceil(tokenCount * 0.4));
}

/** Whether a job title is plausibly related to the search name / intent. */
export function jobTitleMatchesSearch(
  title: string,
  name: string,
  intent?: string | null,
): boolean {
  const tokens = extractSearchTokens(name, intent);
  if (!tokens.length) return true;

  const hay = title.toLowerCase();
  const hits = tokens.filter((t) => hay.includes(t)).length;
  return hits >= requiredTokenMatches(tokens.length);
}

/**
 * Best-effort phrase for ATS board `extraKeywords` when the user left it blank.
 * Uses the last two significant words from the primary (comma-first) segment.
 */
export function deriveBoardTitlePhrase(name: string): string | undefined {
  const primary = (name.split(",")[0] ?? name).trim();
  const words = tokenize(primary);
  if (!words.length) return undefined;
  if (words.length === 1) return words[0];
  return words.slice(-2).join(" ");
}

export function isAtsBoardKind(kind: string): boolean {
  return BOARD_KINDS.has(kind);
}
