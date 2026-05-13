/**
 * Shared Zod schemas for API request bodies + provider source configs.
 * Reused on both server and client where helpful.
 */
import { z } from "zod";

// --- Provider source configs ----------------------------------------------

export const AggregatorQueryConfig = z.object({
  keywords: z.string().min(1).max(200),
  location: z.string().max(200).optional().nullable(),
  country: z.string().length(2).optional().nullable(),
  remoteOnly: z.boolean().optional(),
  maxResults: z.number().int().positive().max(100).optional(),
});
export type AggregatorQueryConfig = z.infer<typeof AggregatorQueryConfig>;

export const AtsBoardConfig = z.object({
  // For Greenhouse: board token (e.g. "stripe"). For Lever: site slug.
  boardToken: z.string().min(1).max(100),
  // Optional post-fetch filter; case-insensitive substring match on title.
  extraKeywords: z.string().max(200).optional().nullable(),
});
export type AtsBoardConfig = z.infer<typeof AtsBoardConfig>;

export const SourceKind = z.enum([
  "adzuna_query",
  "arbeitnow_query",
  "remotive_query",
  "greenhouse_board",
  "lever_board",
  "ashby_board",
]);
export type SourceKind = z.infer<typeof SourceKind>;

// Discriminate config shape by kind.
export const SourceInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("adzuna_query"), config: AggregatorQueryConfig }),
  z.object({
    kind: z.literal("arbeitnow_query"),
    config: AggregatorQueryConfig,
  }),
  z.object({ kind: z.literal("remotive_query"), config: AggregatorQueryConfig }),
  z.object({ kind: z.literal("greenhouse_board"), config: AtsBoardConfig }),
  z.object({ kind: z.literal("lever_board"), config: AtsBoardConfig }),
  z.object({ kind: z.literal("ashby_board"), config: AtsBoardConfig }),
]);
export type SourceInput = z.infer<typeof SourceInput>;

// --- Role type bodies ------------------------------------------------------

export const RoleTypeCreate = z.object({
  name: z.string().min(1).max(120),
  intent: z.string().max(2000).optional().nullable(),
  sortOrder: z.number().int().optional(),
  sources: z.array(SourceInput).default([]),
});
export type RoleTypeCreate = z.infer<typeof RoleTypeCreate>;

export const RoleTypeUpdate = z.object({
  name: z.string().min(1).max(120).optional(),
  intent: z.string().max(2000).optional().nullable(),
  sortOrder: z.number().int().optional(),
});
export type RoleTypeUpdate = z.infer<typeof RoleTypeUpdate>;

export const SourceUpdate = z.object({
  config: z.union([AggregatorQueryConfig, AtsBoardConfig]),
});
export type SourceUpdate = z.infer<typeof SourceUpdate>;

// --- Job state ------------------------------------------------------------

export const JobStateUpdate = z.object({
  favorite: z.boolean().optional(),
  hidden: z.boolean().optional(),
});
export type JobStateUpdate = z.infer<typeof JobStateUpdate>;

// --- Suggest-from-job-url -------------------------------------------------

export const SuggestFromUrlBody = z.object({
  url: z
    .url()
    .max(2048)
    .refine((u) => u.startsWith("https://"), {
      message: "Only https URLs are supported",
    }),
});
export type SuggestFromUrlBody = z.infer<typeof SuggestFromUrlBody>;
