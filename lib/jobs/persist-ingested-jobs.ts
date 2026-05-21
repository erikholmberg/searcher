import { prisma } from "@/lib/db";
import type { NormalizedJob } from "@/lib/jobs/types";
import type { Prisma } from "@prisma/client";

export interface PersistIngestedResult {
  addedRoleTypeJobIds: string[];
}

/**
 * Batch upsert listings and link new jobs to a role type in one transaction.
 */
export async function persistIngestedJobs(
  roleTypeId: string,
  sourceId: string,
  jobs: NormalizedJob[],
  dismissedExternalIds: Set<string>,
): Promise<PersistIngestedResult> {
  const eligible = jobs.filter((j) => !dismissedExternalIds.has(j.externalId));
  if (!eligible.length) {
    return { addedRoleTypeJobIds: [] };
  }

  const now = new Date();
  const externalIds = eligible.map((j) => j.externalId);

  return prisma.$transaction(async (tx) => {
    const existingListings = await tx.jobListing.findMany({
      where: { externalId: { in: externalIds } },
      select: { id: true, externalId: true },
    });
    const listingByExternal = new Map(
      existingListings.map((l) => [l.externalId, l.id]),
    );

    const creates: Prisma.JobListingCreateManyInput[] = [];
    for (const j of eligible) {
      if (listingByExternal.has(j.externalId)) continue;
      creates.push({
        externalId: j.externalId,
        source: j.source,
        title: j.title,
        company: j.company,
        url: j.url,
        descriptionSnippet: j.descriptionSnippet,
        postedAt: j.postedAt,
        locationDisplay: j.locationDisplay,
        workMode: j.workMode,
        fetchedAt: now,
      });
    }
    if (creates.length) {
      await tx.jobListing.createMany({ data: creates, skipDuplicates: true });
    }

    const allListings = await tx.jobListing.findMany({
      where: { externalId: { in: externalIds } },
    });
    const listingMap = new Map(allListings.map((l) => [l.externalId, l]));

    for (const j of eligible) {
      const listing = listingMap.get(j.externalId);
      if (!listing) continue;
      await tx.jobListing.update({
        where: { id: listing.id },
        data: {
          title: j.title,
          company: j.company,
          url: j.url,
          descriptionSnippet: j.descriptionSnippet,
          postedAt: j.postedAt,
          source: j.source,
          locationDisplay: j.locationDisplay,
          workMode: j.workMode,
          fetchedAt: now,
        },
      });
    }

    const listingIds = eligible
      .map((j) => listingMap.get(j.externalId)?.id)
      .filter((id): id is string => id != null);

    const existingLinks = await tx.roleTypeJob.findMany({
      where: { roleTypeId, jobListingId: { in: listingIds } },
      select: { jobListingId: true },
    });
    const linkedListingIds = new Set(
      existingLinks.map((l) => l.jobListingId),
    );

    const linkCreates: Prisma.RoleTypeJobCreateManyInput[] = [];
    for (const j of eligible) {
      const listing = listingMap.get(j.externalId);
      if (!listing || linkedListingIds.has(listing.id)) continue;
      linkCreates.push({
        roleTypeId,
        jobListingId: listing.id,
        sourceId,
        matchScore: j.matchScore ?? undefined,
      });
    }

    if (!linkCreates.length) {
      return { addedRoleTypeJobIds: [] };
    }

    await tx.roleTypeJob.createMany({
      data: linkCreates,
      skipDuplicates: true,
    });

    const newLinks = await tx.roleTypeJob.findMany({
      where: {
        roleTypeId,
        jobListingId: { in: linkCreates.map((l) => l.jobListingId) },
      },
      select: { id: true },
    });

    return { addedRoleTypeJobIds: newLinks.map((l) => l.id) };
  });
}
