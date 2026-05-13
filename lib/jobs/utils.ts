import { WorkMode } from "@/lib/types";

export function stripHtml(input: string, max = 800): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function inferWorkMode(text: string | null | undefined): WorkMode {
  if (!text) return "unknown";
  const t = text.toLowerCase();
  if (/\b(fully\s+)?remote\b/.test(t) && !/hybrid|on[- ]?site|no remote/.test(t))
    return "remote";
  if (/\bhybrid\b/.test(t)) return "hybrid";
  if (/\bon[- ]?site\b/.test(t) || /\bin[- ]office\b/.test(t)) return "onsite";
  return "unknown";
}

export function parseDate(s: string | number | null | undefined): Date | null {
  if (!s) return null;
  if (typeof s === "number") return new Date(s);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
