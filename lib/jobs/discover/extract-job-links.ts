/**
 * Extract same-origin job posting links from a careers listing HTML page.
 */

export interface JobLinkCandidate {
  url: string;
  titleHint: string | null;
}

const JOB_PATH_RE =
  /\/(?:jobs?|careers?|positions?|openings?|roles?|opportunit|vacanc)/i;

const EXCLUDE_PATH_RE =
  /\/(?:login|signin|signup|register|privacy|terms|cookie|legal|about|blog|news|press|contact|faq|help|support)(?:\/|$)/i;

const EXCLUDE_HREF_RE =
  /^(?:mailto:|tel:|javascript:|#)|\.pdf(?:\?|$)/i;

const BOILERPLATE_ANCHOR_RE =
  /^(?:apply|learn more|read more|view all|see all|back|home|careers|jobs)$/i;

function normalizeUrl(href: string, base: URL): string | null {
  try {
    const u = new URL(href, base.href);
    if (u.protocol !== "https:") return null;
    if (u.origin !== base.origin) return null;
    u.hash = "";
    return u.href.replace(/\/$/, "") || u.href;
  } catch {
    return null;
  }
}

function looksLikeJobLink(url: URL, anchorText: string): boolean {
  if (EXCLUDE_PATH_RE.test(url.pathname)) return false;
  if (JOB_PATH_RE.test(url.pathname)) return true;
  const t = anchorText.trim();
  if (t.length < 8 || t.length > 120) return false;
  if (BOILERPLATE_ANCHOR_RE.test(t)) return false;
  if (/^\d+$/.test(t)) return false;
  return true;
}

/**
 * Parse anchor tags and return deduped job-like links (max `cap`).
 */
export function extractJobLinksFromHtml(
  html: string,
  seedUrl: string,
  cap = 40,
): JobLinkCandidate[] {
  let base: URL;
  try {
    base = new URL(seedUrl);
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const out: JobLinkCandidate[] = [];

  const anchorRe =
    /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = m[1].trim();
    if (!href || EXCLUDE_HREF_RE.test(href)) continue;

    const resolved = normalizeUrl(href, base);
    if (!resolved || seen.has(resolved)) continue;

    const anchorText = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const parsed = new URL(resolved);
    if (!looksLikeJobLink(parsed, anchorText)) continue;

    seen.add(resolved);
    out.push({
      url: resolved,
      titleHint: anchorText.length ? anchorText.slice(0, 200) : null,
    });
    if (out.length >= cap) break;
  }

  const seedNorm = normalizeUrl(seedUrl, base);
  if (seedNorm && !seen.has(seedNorm)) {
    out.unshift({ url: seedNorm, titleHint: null });
  }

  return out;
}

export function countJobLikeLinks(html: string, seedUrl: string): number {
  return extractJobLinksFromHtml(html, seedUrl, 200).length;
}
