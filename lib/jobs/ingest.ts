/**
 * Run ingestion for a role type: iterate its sources, dedupe via JobListing
 * upsert + RoleTypeJob unique constraint, and persist paginationState.
 *
 * `refresh` resets paginationState to first window; `find-more` advances it.
 */
import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/jobs/registry";
import type { SourceKindString } from "@/lib/types";
import type { Prisma } from "@prisma/client";

export interface IngestSummary {
  addedCount: number;
  exhausted: boolean;
  perSource: Array<{
    sourceId: string;
    kind: SourceKindString;
    added: number;
    exhausted: boolean;
    error?: string;
  }>;
}

export async function ingestRoleType(
  roleTypeId: string,
  options: { mode: "refresh" | "find-more" },
): Promise<IngestSummary> {
  const sources = await prisma.roleTypeSource.findMany({
    where: { roleTypeId },
    orderBy: { createdAt: "asc" },
  });

  const perSource: IngestSummary["perSource"] = [];
  let total = 0;
  let allExhausted = sources.length > 0;

  for (const source of sources) {
    const provider = getProvider(source.kind as SourceKindString);
    if (!provider) {
      perSource.push({
        sourceId: source.id,
        kind: source.kind as SourceKindString,
        added: 0,
        exhausted: false,
        error: `No provider for kind ${source.kind}`,
      });
      allExhausted = false;
      continue;
    }

    const inputState =
      options.mode === "refresh" ? null : (source.paginationState ?? null);

    let result;
    try {
      result = await provider.fetchPage(source.config, inputState);
    } catch (err) {
      perSource.push({
        sourceId: source.id,
        kind: source.kind as SourceKindString,
        added: 0,
        exhausted: false,
        error: (err as Error).message,
      });
      await prisma.roleTypeSource.update({
        where: { id: source.id },
        data: { lastErrorMessage: (err as Error).message },
      });
      allExhausted = false;
      continue;
    }

    let added = 0;
    for (const j of result.jobs) {
      const listing = await prisma.jobListing.upsert({
        where: { externalId: j.externalId },
        update: {
          title: j.title,
          company: j.company,
          url: j.url,
          descriptionSnippet: j.descriptionSnippet,
          postedAt: j.postedAt,
          source: j.source,
          locationDisplay: j.locationDisplay,
          workMode: j.workMode,
          fetchedAt: new Date(),
        },
        create: {
          externalId: j.externalId,
          source: j.source,
          title: j.title,
          company: j.company,
          url: j.url,
          descriptionSnippet: j.descriptionSnippet,
          postedAt: j.postedAt,
          locationDisplay: j.locationDisplay,
          workMode: j.workMode,
        },
      });

      try {
        await prisma.roleTypeJob.create({
          data: {
            roleTypeId,
            jobListingId: listing.id,
            sourceId: source.id,
          },
        });
        added += 1;
      } catch (err) {
        // Unique constraint (roleTypeId, jobListingId) → already linked, skip.
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code?: string }).code === "P2002"
        ) {
          continue;
        }
        throw err;
      }
    }

    await prisma.roleTypeSource.update({
      where: { id: source.id },
      data: {
        paginationState: (result.nextState ?? null) as Prisma.InputJsonValue | typeof Prisma.DbNull,
        lastFetchedAt: new Date(),
        lastErrorMessage: null,
      },
    });

    perSource.push({
      sourceId: source.id,
      kind: source.kind as SourceKindString,
      added,
      exhausted: result.exhausted,
    });
    total += added;
    if (!result.exhausted) allExhausted = false;
  }

  return { addedCount: total, exhausted: allExhausted, perSource };
}
