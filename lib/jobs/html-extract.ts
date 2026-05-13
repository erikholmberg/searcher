import type { WorkMode } from "@/lib/types";
import { decodeHtmlEntities } from "@/lib/jobs/utils";

/** Strip tags / boilerplate blocks; cap length for prompts. */
export function stripHtmlToText(input: string, max = 12000): string {
  const decoded = decodeHtmlEntities(input);
  return decoded
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function inferWorkMode(text: string | null | undefined): WorkMode {
  if (!text) return "unknown";
  const t = text.toLowerCase();
  if (/\bremote\b/.test(t) && !/hybrid|on[- ]?site/.test(t)) return "remote";
  if (/\bhybrid\b/.test(t)) return "hybrid";
  if (/\bon[- ]?site\b/.test(t) || /\bin[- ]office\b/.test(t)) return "onsite";
  return "unknown";
}

function metaByProp(
  html: string,
  prop: string,
  mode: "property" | "name",
): string | null {
  const attr = mode === "property" ? "property" : "name";
  const patterns = [
    new RegExp(
      `<meta[^>]+${attr}=["']${prop}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${prop}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtmlEntities(m[1].trim());
  }
  return null;
}

export function extractGenericPageSignals(html: string): {
  title: string | null;
  siteName: string | null;
  description: string | null;
} {
  const ogTitle = metaByProp(html, "og:title", "property");
  const titleTag = html.match(/<title[^>]*>([^<]{1,500})<\/title>/i);
  const titleFromTag = titleTag?.[1]
    ? decodeHtmlEntities(titleTag[1].trim())
    : null;
  const title = ogTitle ?? titleFromTag;
  return {
    title: title?.length ? title : null,
    siteName: metaByProp(html, "og:site_name", "property"),
    description:
      metaByProp(html, "og:description", "property") ??
      metaByProp(html, "description", "name"),
  };
}

export function buildGenericJobExcerpt(html: string, max = 10000): string {
  const sig = extractGenericPageSignals(html);
  const bodyText = stripHtmlToText(html, max);
  const head = [sig.description, sig.title].filter(Boolean).join("\n\n");
  const combined = head ? `${head}\n\n---\n\n${bodyText}` : bodyText;
  return combined.slice(0, max);
}
