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

const httpsJobPageUrl = z
  .string()
  .url()
  .max(2048)
  .refine((u) => u.startsWith("https://"), {
    message: "Only https URLs are supported",
  });

export const PublicJobPostingConfig = z.object({
  /** Public job posting page (same fetch rules as “Suggest from job URL”). */
  url: httpsJobPageUrl,
});
export type PublicJobPostingConfig = z.infer<typeof PublicJobPostingConfig>;

export const CareersSiteConfig = z.object({
  seedUrl: httpsJobPageUrl,
  listingUrl: httpsJobPageUrl.optional().nullable(),
  seedTitle: z.string().max(500).optional().nullable(),
  seedExcerpt: z.string().max(10000).optional().nullable(),
  maxJobs: z.number().int().positive().max(30).optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
});
export type CareersSiteConfig = z.infer<typeof CareersSiteConfig>;

export const SourceKind = z.enum([
  "adzuna_query",
  "arbeitnow_query",
  "remotive_query",
  "greenhouse_board",
  "lever_board",
  "ashby_board",
  "public_job_posting",
  "careers_site",
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
  z.object({
    kind: z.literal("public_job_posting"),
    config: PublicJobPostingConfig,
  }),
  z.object({ kind: z.literal("careers_site"), config: CareersSiteConfig }),
]);
export type SourceInput = z.infer<typeof SourceInput>;

const WorkModeSchema = z.enum(["remote", "hybrid", "onsite", "unknown"]);

/** Normalized listing from suggest-from-URL; attached to the role on create. */
export const SeedListingInput = z.object({
  externalId: z.string().min(1).max(200),
  source: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  company: z.string().min(1).max(200),
  url: httpsJobPageUrl,
  descriptionSnippet: z.string().max(10000).optional().nullable(),
  postedAt: z.coerce.date().optional().nullable(),
  locationDisplay: z.string().max(500).optional().nullable(),
  workMode: WorkModeSchema,
});
export type SeedListingInput = z.infer<typeof SeedListingInput>;

// --- Search (RoleType) bodies ----------------------------------------------

export const RoleTypeCreate = z.object({
  name: z.string().min(1).max(120),
  intent: z.string().max(2000).optional().nullable(),
  sortOrder: z.number().int().optional(),
  sources: z.array(SourceInput).default([]),
  /** Inspiration job from “from job URL”; upserted and linked after create. */
  seedListing: SeedListingInput.optional(),
});
export type RoleTypeCreate = z.infer<typeof RoleTypeCreate>;

export const RoleTypeUpdate = z.object({
  name: z.string().min(1).max(120).optional(),
  intent: z.string().max(2000).optional().nullable(),
  sortOrder: z.number().int().optional(),
});
export type RoleTypeUpdate = z.infer<typeof RoleTypeUpdate>;

export const SourceUpdate = z.object({
  config: z.union([
    AggregatorQueryConfig,
    AtsBoardConfig,
    PublicJobPostingConfig,
    CareersSiteConfig,
  ]),
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
