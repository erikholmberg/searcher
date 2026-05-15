import { createHash } from "node:crypto";
import type { ResolvedPosting } from "@/lib/jobs/resolve-job-url";
import type { NormalizedJob } from "@/lib/jobs/types";
import { prisma } from "@/lib/db";
import type { WorkMode } from "@/lib/types";
import type { Prisma } from "@prisma/client";

export function publicJobExternalId(canonicalUrl: string): string {
  const idHash = createHash("sha256")
    .update(canonicalUrl)
    .digest("hex")
    .slice(0, 40);
  return `public_job:${idHash}`;
}

export function seedListingFromStructured(posting: ResolvedPosting): NormalizedJob {
  const prefix = posting.source;
  return {
    externalId: `${prefix}:${posting.boardToken}:${posting.jobId}`,
    source: `${prefix}:${posting.boardToken}`,
    title: posting.title,
    company: posting.company,
    url: posting.url,
    descriptionSnippet: posting.snippet,
    postedAt: null,
    locationDisplay: posting.locationDisplay,
    workMode: posting.workMode,
  };
}

export function seedListingFromGeneric(fields: {
  title: string;
  company: string;
  url: string;
  snippet: string | null;
  locationDisplay: string | null;
  workMode: WorkMode;
}): NormalizedJob {
  return {
    externalId: publicJobExternalId(fields.url),
    source: "public_job",
    title: fields.title,
    company: fields.company,
    url: fields.url,
    descriptionSnippet: fields.snippet,
    postedAt: null,
    locationDisplay: fields.locationDisplay,
    workMode: fields.workMode,
  };
}

export type SeedListingInput = NormalizedJob;

/**
 * Upsert the inspiration job and link it to the new role type (idempotent).
 */
export async function attachSeedListingToRoleType(
  roleTypeId: string,
  seed: SeedListingInput,
  options?: { sourceId?: string | null },
): Promise<void> {
  const listing = await prisma.jobListing.upsert({
    where: { externalId: seed.externalId },
    update: {
      title: seed.title,
      company: seed.company,
      url: seed.url,
      descriptionSnippet: seed.descriptionSnippet,
      postedAt: seed.postedAt,
      source: seed.source,
      locationDisplay: seed.locationDisplay,
      workMode: seed.workMode,
      fetchedAt: new Date(),
    },
    create: {
      externalId: seed.externalId,
      source: seed.source,
      title: seed.title,
      company: seed.company,
      url: seed.url,
      descriptionSnippet: seed.descriptionSnippet,
      postedAt: seed.postedAt,
      locationDisplay: seed.locationDisplay,
      workMode: seed.workMode,
    },
  });

  try {
    await prisma.roleTypeJob.create({
      data: {
        roleTypeId,
        jobListingId: listing.id,
        sourceId: options?.sourceId ?? null,
      },
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return;
    }
    throw err;
  }
}

/** Pick a source row to attribute the seed job when possible. */
export function pickSeedSourceId(
  sources: Array<{ id: string; kind: string; config: Prisma.JsonValue }>,
  seed: SeedListingInput,
): string | null {
  for (const s of sources) {
    if (s.kind === "public_job_posting") {
      const cfg = s.config as { url?: string };
      if (cfg.url && publicJobExternalId(cfg.url.trim()) === seed.externalId) {
        return s.id;
      }
    }
    if (s.kind === "greenhouse_board" && seed.source.startsWith("greenhouse:")) {
      const token = seed.source.slice("greenhouse:".length);
      const cfg = s.config as { boardToken?: string };
      if (cfg.boardToken === token) return s.id;
    }
    if (s.kind === "lever_board" && seed.source.startsWith("lever:")) {
      const token = seed.source.slice("lever:".length);
      const cfg = s.config as { boardToken?: string };
      if (cfg.boardToken === token) return s.id;
    }
  }
  return null;
}
