import { WorkMode } from "@/lib/types";

/** Decode common HTML entities (including numeric) before stripping tags. */
export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, num: string) => {
      const n = Number(num);
      if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return _;
      try {
        return String.fromCodePoint(n);
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
      const n = parseInt(hex, 16);
      if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return _;
      try {
        return String.fromCodePoint(n);
      } catch {
        return _;
      }
    });
}

export function stripHtml(input: string, max = 800): string {
  const decoded = decodeHtmlEntities(input);
  return decoded
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** US-style "City, ST" (ST = 2 letter region) — used for office-location hints. */
const CITY_COMMA_REGION = /\b[a-z][a-z\s'.-]{1,40},\s*[a-z]{2}\b/;

export function inferWorkMode(text: string | null | undefined): WorkMode {
  if (!text) return "unknown";
  const t = text.toLowerCase();
  if (/\b(fully\s+)?remote\b/.test(t) && !/hybrid|on[- ]?site|no remote/.test(t))
    return "remote";
  if (/\bhybrid\b/.test(t)) return "hybrid";
  if (/\bon[- ]?site\b/.test(t) || /\bin[- ]office\b/.test(t)) return "onsite";
  // Greenhouse and others often put only office cities in location (e.g. "SF, CA | NYC, NY | Seattle, WA")
  // with no explicit "remote" — treat multi-office geography as onsite when not contradicted.
  if (!/\bremote\b/.test(t) && !/\bhybrid\b/.test(t) && t.includes("|")) {
    const segments = t.split("|").map((s) => s.trim()).filter(Boolean);
    const officeLike = segments.filter((s) => CITY_COMMA_REGION.test(s));
    if (officeLike.length >= 2) return "onsite";
  }
  return "unknown";
}

export function parseDate(s: string | number | null | undefined): Date | null {
  if (!s) return null;
  if (typeof s === "number") return new Date(s);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
