/**
 * Run ingestion for a role type: iterate its sources, dedupe via JobListing
 * upsert + RoleTypeJob unique constraint, and persist paginationState.
 *
 * `refresh` resets paginationState to first window; `find-more` advances it.
 * Providers with `expandRefreshToAllPages` pull every slice in one refresh
 * (e.g. Greenhouse boards sliced client-side).
 */
import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/jobs/registry";
import type { SourceKindString } from "@/lib/types";
import type { Prisma } from "@prisma/client";
import type { FetchPageResult } from "@/lib/jobs/types";

const MAX_EXPAND_REFRESH_PAGES = 200;

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
  const roleType = await prisma.roleType.findUnique({
    where: { id: roleTypeId },
    select: { intent: true },
  });
  if (!roleType) {
    return { addedCount: 0, exhausted: true, perSource: [] };
  }

  const dismissedRows = await prisma.roleTypeDismissedJob.findMany({
    where: { roleTypeId },
    select: { externalId: true },
  });
  const dismissedExternalIds = new Set(dismissedRows.map((d) => d.externalId));

  const sources = await prisma.roleTypeSource.findMany({
    where: { roleTypeId },
    orderBy: { createdAt: "asc" },
  });

  let linkedExternalIds: string[] | null = null;
  if (options.mode === "find-more") {
    const linked = await prisma.roleTypeJob.findMany({
      where: { roleTypeId },
      select: { jobListing: { select: { externalId: true } } },
    });
    linkedExternalIds = linked.map((r) => r.jobListing.externalId);
  }

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

    let inputState: unknown | null =
      options.mode === "refresh" ? null : (source.paginationState ?? null);

    if (source.kind === "careers_site" && options.mode === "find-more") {
      inputState = {
        skipExternalIds: linkedExternalIds ?? [],
        searchIntent: roleType.intent,
      };
    }

    const providerConfig =
      source.kind === "careers_site"
        ? {
            ...(source.config as Record<string, unknown>),
            searchIntent: roleType.intent,
          }
        : source.config;

    const expandRefresh = provider.expandRefreshToAllPages === true;
    let cursor: unknown | null = inputState;
    let added = 0;
    let lastResult: FetchPageResult = {
      jobs: [],
      nextState: null,
      exhausted: true,
    };
    let iterations = 0;

    try {
      while (true) {
        iterations += 1;
        lastResult = await provider.fetchPage(
          providerConfig,
          cursor as never,
        );

        for (const j of lastResult.jobs) {
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

          if (dismissedExternalIds.has(listing.externalId)) {
            continue;
          }

          try {
            await prisma.roleTypeJob.create({
              data: {
                roleTypeId,
                jobListingId: listing.id,
                sourceId: source.id,
                matchScore: j.matchScore ?? undefined,
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

        const pullAnotherRefreshSlice =
          options.mode === "refresh" &&
          expandRefresh &&
          !lastResult.exhausted &&
          lastResult.nextState != null &&
          iterations < MAX_EXPAND_REFRESH_PAGES;

        if (pullAnotherRefreshSlice) {
          cursor = lastResult.nextState;
          continue;
        }
        break;
      }

      await prisma.roleTypeSource.update({
        where: { id: source.id },
        data: {
          paginationState: (lastResult.nextState ??
            null) as Prisma.InputJsonValue | typeof Prisma.DbNull,
          lastFetchedAt: new Date(),
          lastErrorMessage: null,
        },
      });

      perSource.push({
        sourceId: source.id,
        kind: source.kind as SourceKindString,
        added,
        exhausted: lastResult.exhausted,
      });
      total += added;
      if (!lastResult.exhausted) allExhausted = false;
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
    }
  }

  return { addedCount: total, exhausted: allExhausted, perSource };
}
