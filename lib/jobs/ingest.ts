/**
 * Run ingestion for a role type: iterate its sources, dedupe via JobListing
 * upsert + RoleTypeJob unique constraint, and persist paginationState.
 */
import { prisma } from "@/lib/db";
import { clearBoardFetchCache } from "@/lib/jobs/board-fetch-cache";
import {
  deriveBoardTitlePhrase,
  isAtsBoardKind,
  jobTitleMatchesSearch,
} from "@/lib/jobs/match-search-query";
import { persistIngestedJobs } from "@/lib/jobs/persist-ingested-jobs";
import { getProvider } from "@/lib/jobs/registry";
import type { SourceKindString } from "@/lib/types";
import type { Prisma } from "@prisma/client";
import type { FetchPageResult, NormalizedJob } from "@/lib/jobs/types";
import type { AtsBoardConfig } from "@/lib/schemas";

const MAX_EXPAND_REFRESH_PAGES = 200;

export interface IngestSummary {
  addedCount: number;
  addedJobIds: string[];
  skippedIrrelevant: number;
  exhausted: boolean;
  perSource: Array<{
    sourceId: string;
    kind: SourceKindString;
    added: number;
    skippedIrrelevant: number;
    exhausted: boolean;
    error?: string;
  }>;
}

function filterJobsForSearch(
  jobs: NormalizedJob[],
  name: string,
  intent: string | null,
  skipTitleRelevance: boolean,
): { accepted: NormalizedJob[]; skipped: number } {
  if (skipTitleRelevance) {
    return { accepted: jobs, skipped: 0 };
  }
  let skipped = 0;
  const accepted: NormalizedJob[] = [];
  for (const j of jobs) {
    if (jobTitleMatchesSearch(j.title, name, intent)) {
      accepted.push(j);
    } else {
      skipped += 1;
    }
  }
  return { accepted, skipped };
}

async function ingestOneSource(
  roleTypeId: string,
  roleType: { name: string; intent: string | null },
  source: {
    id: string;
    kind: string;
    config: unknown;
    paginationState: unknown;
  },
  options: { mode: "refresh" | "find-more" },
  dismissedExternalIds: Set<string>,
  linkedExternalIds: string[] | null,
): Promise<{
  added: number;
  addedJobIds: string[];
  skippedIrrelevant: number;
  exhausted: boolean;
  error?: string;
}> {
  const kind = source.kind as SourceKindString;
  const provider = getProvider(kind);
  if (!provider) {
    return {
      added: 0,
      addedJobIds: [],
      skippedIrrelevant: 0,
      exhausted: false,
      error: `No provider for kind ${source.kind}`,
    };
  }

  let inputState: unknown | null =
    options.mode === "refresh" ? null : (source.paginationState ?? null);

  if (source.kind === "careers_site" && options.mode === "find-more") {
    inputState = {
      skipExternalIds: linkedExternalIds ?? [],
      searchIntent: roleType.intent,
    };
  }

  let providerConfig: unknown =
    source.kind === "careers_site"
      ? {
          ...(source.config as Record<string, unknown>),
          searchIntent: roleType.intent,
        }
      : source.config;

  if (isAtsBoardKind(source.kind)) {
    const boardCfg = source.config as AtsBoardConfig;
    if (!boardCfg.extraKeywords?.trim()) {
      const phrase = deriveBoardTitlePhrase(roleType.name);
      if (phrase) {
        providerConfig = { ...boardCfg, extraKeywords: phrase };
      }
    }
  }

  const expandRefresh = provider.expandRefreshToAllPages === true;
  let cursor: unknown | null = inputState;
  let added = 0;
  const addedJobIds: string[] = [];
  let skippedIrrelevant = 0;
  const skipTitleRelevance = source.kind === "public_job_posting";
  let lastResult: FetchPageResult = {
    jobs: [],
    nextState: null,
    exhausted: true,
  };
  let iterations = 0;

  while (true) {
    iterations += 1;
    lastResult = await provider.fetchPage(providerConfig, cursor as never);

    const { accepted, skipped } = filterJobsForSearch(
      lastResult.jobs,
      roleType.name,
      roleType.intent,
      skipTitleRelevance,
    );
    skippedIrrelevant += skipped;

    if (accepted.length) {
      const persisted = await persistIngestedJobs(
        roleTypeId,
        source.id,
        accepted,
        dismissedExternalIds,
      );
      added += persisted.addedRoleTypeJobIds.length;
      addedJobIds.push(...persisted.addedRoleTypeJobIds);
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

  return {
    added,
    addedJobIds,
    skippedIrrelevant,
    exhausted: lastResult.exhausted,
  };
}

export async function ingestRoleType(
  roleTypeId: string,
  options: { mode: "refresh" | "find-more" },
): Promise<IngestSummary> {
  clearBoardFetchCache();

  const roleType = await prisma.roleType.findUnique({
    where: { id: roleTypeId },
    select: { name: true, intent: true },
  });
  if (!roleType) {
    return {
      addedCount: 0,
      addedJobIds: [],
      skippedIrrelevant: 0,
      exhausted: true,
      perSource: [],
    };
  }

  const [dismissedRows, sources, linkedRows] = await Promise.all([
    prisma.roleTypeDismissedJob.findMany({
      where: { roleTypeId },
      select: { externalId: true },
    }),
    prisma.roleTypeSource.findMany({
      where: { roleTypeId },
      orderBy: { createdAt: "asc" },
    }),
    options.mode === "find-more"
      ? prisma.roleTypeJob.findMany({
          where: { roleTypeId },
          select: { jobListing: { select: { externalId: true } } },
        })
      : Promise.resolve([]),
  ]);

  const dismissedExternalIds = new Set(dismissedRows.map((d) => d.externalId));
  const linkedExternalIds =
    options.mode === "find-more"
      ? linkedRows.map((r) => r.jobListing.externalId)
      : null;

  const perSource: IngestSummary["perSource"] = [];
  let total = 0;
  let skippedIrrelevantTotal = 0;
  const allAddedJobIds: string[] = [];
  let allExhausted = sources.length > 0;

  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        return {
          source,
          result: await ingestOneSource(
            roleTypeId,
            roleType,
            source,
            options,
            dismissedExternalIds,
            linkedExternalIds,
          ),
        };
      } catch (err) {
        await prisma.roleTypeSource.update({
          where: { id: source.id },
          data: { lastErrorMessage: (err as Error).message },
        });
        return {
          source,
          result: {
            added: 0,
            addedJobIds: [] as string[],
            skippedIrrelevant: 0,
            exhausted: false,
            error: (err as Error).message,
          },
        };
      }
    }),
  );

  for (const { source, result } of results) {
    perSource.push({
      sourceId: source.id,
      kind: source.kind as SourceKindString,
      added: result.added,
      skippedIrrelevant: result.skippedIrrelevant,
      exhausted: result.exhausted,
      error: result.error,
    });
    total += result.added;
    skippedIrrelevantTotal += result.skippedIrrelevant;
    allAddedJobIds.push(...result.addedJobIds);
    if (!result.exhausted) allExhausted = false;
  }

  return {
    addedCount: total,
    addedJobIds: allAddedJobIds,
    skippedIrrelevant: skippedIrrelevantTotal,
    exhausted: allExhausted,
    perSource,
  };
}
