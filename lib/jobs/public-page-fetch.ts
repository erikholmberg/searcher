/**
 * Fetch public https pages for the suggest-from-URL flow with basic SSRF
 * defenses (scheme/host/port, DNS → IP checks, redirect re-validation).
 */
import dns from "node:dns/promises";
import https from "node:https";
import net from "node:net";

const MAX_REDIRECTS = 8;
const MAX_BODY_CHARS = 1_500_000;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_BODY_BYTES = 4_500_000;

const BLOCKED_HOSTNAMES = new Set(
  [
    "localhost",
    "0.0.0.0",
    "metadata.google.internal",
    "metadata",
    "kubernetes.default",
    "kubernetes.default.svc",
    "kubernetes.default.svc.cluster.local",
  ].map((h) => h.toLowerCase()),
);

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".corp",
  ".home",
  ".localdomain",
];

function isBlockedIpv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return true;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return true;
  if (a === 0 || a === 127 || a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224 && a <= 239) return true;
  return false;
}

function isBlockedIp(address: string): boolean {
  if (net.isIPv4(address)) return isBlockedIpv4(address);
  if (!net.isIPv6(address)) return true;
  const a = address.toLowerCase();
  if (a === "::1") return true;
  if (a.startsWith("fe80:")) return true;
  if (a.startsWith("fc") || a.startsWith("fd")) return true;
  if (a.startsWith("ff")) return true;
  const mapped = a.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return isBlockedIpv4(mapped[1]);
  return false;
}

function isHostnameBlocked(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  for (const suf of BLOCKED_HOST_SUFFIXES) {
    if (h === suf.slice(1)) continue;
    if (h.endsWith(suf)) return true;
  }
  return false;
}

async function assertResolvableHostIsPublic(hostname: string): Promise<void> {
  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error(`Could not resolve host: ${hostname}`);
  }
  if (!records.length) throw new Error(`No DNS records for host: ${hostname}`);
  for (const { address } of records) {
    if (isBlockedIp(address)) {
      throw new Error("Host resolves to a disallowed network address");
    }
  }
}

async function resolvePublicAddress(hostname: string): Promise<{
  address: string;
  family: 4 | 6;
}> {
  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error(`Could not resolve host: ${hostname}`);
  }
  const publicRecord = records.find((r) => !isBlockedIp(r.address));
  if (!publicRecord) {
    throw new Error("Host resolves to a disallowed network address");
  }
  return {
    address: publicRecord.address,
    family: publicRecord.family === 6 ? 6 : 4,
  };
}

/**
 * Validate URL for server-side fetch. Throws with a short message on reject.
 */
export async function assertUrlSafeForPublicFetch(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "https:") {
    throw new Error("Only https URLs are allowed");
  }
  if (u.username || u.password) {
    throw new Error("URLs with credentials are not allowed");
  }
  const port = u.port;
  if (port && port !== "443") {
    throw new Error("Only the default HTTPS port is allowed");
  }

  const host = u.hostname;
  if (!host) throw new Error("Missing host");
  if (isHostnameBlocked(host)) {
    throw new Error("Host is not allowed");
  }

  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new Error("Address is not allowed");
  } else {
    await assertResolvableHostIsPublic(host);
  }

  return u;
}

function contentTypeLooksHtml(ct: string | null): boolean {
  if (!ct) return false;
  return /\btext\/html\b/i.test(ct) || /\bapplication\/xhtml\+xml\b/i.test(ct);
}

async function requestPinned(url: URL): Promise<{
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}> {
  const pinned = await resolvePublicAddress(url.hostname);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: "https:",
        hostname: url.hostname,
        port: 443,
        method: "GET",
        path: `${url.pathname}${url.search}`,
        servername: url.hostname,
        headers: {
          Accept:
            "text/html,application/xhtml+xml;q=0.9,application/xml;q=0.8,*/*;q=0.1",
          "User-Agent": "searcher/0.1 (job suggest)",
        },
        lookup(_hostname, _opts, cb) {
          cb(null, pinned.address, pinned.family);
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const headers = res.headers;
        const chunks: Buffer[] = [];
        let bytes = 0;

        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_BODY_BYTES) {
            req.destroy(new Error("Page is too large to process"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status,
            headers,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      },
    );

    req.setTimeout(FETCH_TIMEOUT_MS, () => {
      req.destroy(new Error("Page fetch timed out"));
    });
    req.on("error", (err) => reject(err));
    req.end();
  });
}

/**
 * Follow redirects manually; re-check SSRF on each hop.
 */
export async function fetchHttpsHtmlForSuggest(
  rawUrl: string,
): Promise<{ finalUrl: string; html: string }> {
  let current = (await assertUrlSafeForPublicFetch(rawUrl)).href;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertUrlSafeForPublicFetch(current);
    const currentUrl = new URL(current);
    const res = await requestPinned(currentUrl);

    if (res.status >= 300 && res.status < 400) {
      const locHeader = res.headers.location;
      const loc = Array.isArray(locHeader) ? locHeader[0] : locHeader;
      if (!loc || hop === MAX_REDIRECTS) {
        throw new Error("Too many redirects or missing Location header");
      }
      current = new URL(loc, current).href;
      continue;
    }

    if (res.status < 200 || res.status > 299) {
      throw new Error(`Page fetch failed (${res.status})`);
    }

    const ctHeader = res.headers["content-type"];
    const ct = Array.isArray(ctHeader) ? ctHeader[0] : (ctHeader ?? null);
    const html = res.body;
    if (html.length > MAX_BODY_CHARS) {
      throw new Error("Page is too large to process");
    }

    if (!contentTypeLooksHtml(ct)) {
      const head = html.slice(0, 200).trimStart();
      if (!/^<!DOCTYPE\s+html/i.test(head) && !/^<html[\s>]/i.test(head)) {
        throw new Error(
          "Response is not HTML; paste a link to a job posting web page",
        );
      }
    }

    return { finalUrl: current, html };
  }

  throw new Error("Too many redirects");
}
