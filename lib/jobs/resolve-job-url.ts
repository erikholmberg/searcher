/**
 * Resolve a user-pasted job posting URL into normalized fields, going through
 * an allowlist of well-known ATS hosts (no open proxy).
 *
 * Returns null for unsupported URLs; throws on resolver failures.
 */
import { inferWorkMode, stripHtmlToText } from "@/lib/jobs/html-extract";
import { WorkMode } from "@/lib/types";

export interface ResolvedPosting {
  source: "greenhouse" | "lever";
  boardToken: string;
  jobId: string;
  title: string;
  company: string;
  url: string;
  snippet: string | null;
  locationDisplay: string | null;
  workMode: WorkMode;
}

const ALLOWLIST = new Set([
  "boards.greenhouse.io",
  "job-boards.greenhouse.io",
  "jobs.lever.co",
]);

/** Drupal careers pages that embed Greenhouse board + job id (see drupal-settings-json). */
const PLAYLIST_HOSTS = new Set(["www.playlist.com", "playlist.com"]);

const DRUPAL_SETTINGS_MARKER =
  'data-drupal-selector="drupal-settings-json">';

export function isAllowedHost(host: string): boolean {
  const h = host.toLowerCase();
  return ALLOWLIST.has(h) || PLAYLIST_HOSTS.has(h);
}

async function fetchAllowlistedHtml(
  pageUrl: string,
  maxBytes = 1_500_000,
): Promise<string> {
  const res = await fetch(pageUrl, {
    headers: { Accept: "text/html", "User-Agent": "searcher/0.1" },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Page fetch failed (${res.status})`);
  }
  const text = await res.text();
  if (text.length > maxBytes) {
    throw new Error("Posting page too large");
  }
  return text;
}

function parseGreenhouseFromDrupalSettings(html: string): {
  company_name: string;
  jid: string;
} | null {
  const start = html.indexOf(DRUPAL_SETTINGS_MARKER);
  if (start === -1) return null;
  const jsonStart = start + DRUPAL_SETTINGS_MARKER.length;
  const jsonEnd = html.indexOf("</script>", jsonStart);
  if (jsonEnd === -1) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(html.slice(jsonStart, jsonEnd)) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const mb = (parsed as { mb?: unknown }).mb;
  if (!mb || typeof mb !== "object") return null;
  const gh = (mb as { greenhouse?: unknown }).greenhouse;
  if (!gh || typeof gh !== "object") return null;
  const company_name = (gh as { company_name?: unknown }).company_name;
  const jid = (gh as { jid?: unknown }).jid;
  if (typeof company_name !== "string" || !company_name.trim()) return null;
  if (jid == null || jid === "") return null;
  const jidStr = typeof jid === "number" ? String(jid) : String(jid).trim();
  if (!/^\d+$/.test(jidStr)) return null;
  return { company_name: company_name.trim(), jid: jidStr };
}

/**
 * Playlist/Mindbody Drupal job pages embed Greenhouse identifiers; resolve via public API.
 */
async function resolvePlaylistOpportunityUrl(pageUrl: string): Promise<ResolvedPosting> {
  const html = await fetchAllowlistedHtml(pageUrl);
  const embedded = parseGreenhouseFromDrupalSettings(html);
  if (!embedded) {
    throw new Error(
      "Could not read Greenhouse job metadata from this Playlist page",
    );
  }
  return fetchGreenhouse(embedded.company_name, embedded.jid);
}

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  content?: string;
  location?: { name: string };
  company?: { name?: string };
  metadata?: Array<{ name?: string; value?: unknown }>;
}

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  descriptionPlain?: string;
  description?: string;
  categories?: { location?: string; commitment?: string; team?: string };
  workplaceType?: string;
}

async function fetchGreenhouse(
  boardToken: string,
  jobId: string,
): Promise<ResolvedPosting> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs/${encodeURIComponent(jobId)}?content=true`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "searcher/0.1" },
  });
  if (!res.ok) {
    throw new Error(`Greenhouse fetch failed (${res.status})`);
  }
  const j = (await res.json()) as GreenhouseJob;
  const snippet = j.content ? stripHtmlToText(j.content, 4000) : null;
  return {
    source: "greenhouse",
    boardToken,
    jobId: String(j.id),
    title: j.title,
    company: j.company?.name ?? boardToken,
    url: j.absolute_url,
    snippet,
    locationDisplay: j.location?.name ?? null,
    workMode: inferWorkMode(
      [j.location?.name, snippet].filter(Boolean).join(" "),
    ),
  };
}

async function fetchLever(
  site: string,
  jobId: string,
): Promise<ResolvedPosting> {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(site)}/${encodeURIComponent(jobId)}?mode=json`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "searcher/0.1" },
  });
  if (!res.ok) {
    throw new Error(`Lever fetch failed (${res.status})`);
  }
  const j = (await res.json()) as LeverPosting;
  const snippet = j.descriptionPlain
    ? j.descriptionPlain.slice(0, 4000)
    : j.description
      ? stripHtmlToText(j.description, 4000)
      : null;
  const workplaceType = j.workplaceType?.toLowerCase();
  const workMode: WorkMode =
    workplaceType === "remote" || workplaceType === "on-site" || workplaceType === "onsite"
      ? workplaceType === "remote"
        ? "remote"
        : "onsite"
      : workplaceType === "hybrid"
        ? "hybrid"
        : inferWorkMode(
            [j.categories?.location, j.categories?.commitment, snippet]
              .filter(Boolean)
              .join(" "),
          );
  return {
    source: "lever",
    boardToken: site,
    jobId: j.id,
    title: j.text,
    company: site,
    url: j.hostedUrl ?? j.applyUrl ?? "",
    snippet,
    locationDisplay: j.categories?.location ?? null,
    workMode,
  };
}

/**
 * Parse and resolve a posting URL. Returns null when the host is not allowed
 * or the URL pattern is not recognized.
 */
export async function resolveJobUrl(
  raw: string,
): Promise<ResolvedPosting | null> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;

  const host = parsed.host.toLowerCase();

  // Playlist careers (Drupal) → embedded Greenhouse board + job id
  if (PLAYLIST_HOSTS.has(host)) {
    if (!/^\/careers\/opportunities\/\d+\/?$/.test(parsed.pathname))
      return null;
    return resolvePlaylistOpportunityUrl(parsed.href);
  }

  if (!ALLOWLIST.has(host)) return null;

  // Greenhouse: https://boards.greenhouse.io/<token>/jobs/<id>
  if (
    parsed.host === "boards.greenhouse.io" ||
    parsed.host === "job-boards.greenhouse.io"
  ) {
    const m = parsed.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
    if (!m) return null;
    return fetchGreenhouse(m[1], m[2]);
  }

  // Lever: https://jobs.lever.co/<site>/<uuid>
  if (parsed.host === "jobs.lever.co") {
    const m = parsed.pathname.match(/^\/([^/]+)\/([^/]+)/);
    if (!m) return null;
    return fetchLever(m[1], m[2]);
  }

  return null;
}
