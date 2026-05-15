/**
 * Parse a dropped https job posting URL from DataTransfer (browser DnD).
 */

function normalizeCandidate(raw: string): string {
  return raw.trim().replace(/[)\],.;]+$/g, "");
}

function parseHttpsUrl(candidate: string): string | null {
  const normalized = normalizeCandidate(candidate);
  if (!normalized) return null;
  try {
    const u = new URL(normalized);
    if (u.protocol !== "https:") return null;
    if (!u.hostname) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** First https URL in plain text (e.g. dragged selection). */
function httpsUrlFromPlainText(text: string): string | null {
  const match = text.match(/https:\/\/[^\s<>"']+/i);
  if (!match) return null;
  return parseHttpsUrl(match[0]);
}

/**
 * Extract a public https job URL from a drop event payload.
 * Returns null when no valid https URL is present.
 */
export function extractHttpsJobUrl(data: DataTransfer): string | null {
  const uriList = data.getData("text/uri-list").trim();
  if (uriList) {
    for (const line of uriList.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const parsed = parseHttpsUrl(trimmed);
      if (parsed) return parsed;
    }
  }

  const plain = data.getData("text/plain").trim();
  if (plain) {
    const direct = parseHttpsUrl(plain);
    if (direct) return direct;
    const embedded = httpsUrlFromPlainText(plain);
    if (embedded) return embedded;
  }

  return null;
}

/** Whether the drag payload might contain a droppable URL. */
export function dragPayloadMayContainUrl(data: DataTransfer): boolean {
  const types = Array.from(data.types);
  return (
    types.includes("text/uri-list") ||
    types.includes("text/plain") ||
    types.includes("text/html")
  );
}
