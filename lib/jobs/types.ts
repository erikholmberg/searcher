import { WorkMode, SourceKindString } from "@/lib/types";

export interface NormalizedJob {
  /** Stable identity: `${source}:${providerJobId|canonicalUrl}` */
  externalId: string;
  source: string;
  title: string;
  company: string;
  url: string;
  descriptionSnippet: string | null;
  postedAt: Date | null;
  locationDisplay: string | null;
  workMode: WorkMode;
  /** Set by careers_site and other relevance-aware providers. */
  matchScore?: number | null;
}

export interface FetchPageResult {
  jobs: NormalizedJob[];
  /** Cursor to persist; null when exhausted. */
  nextState: unknown | null;
  /** True when there are no further pages/results. */
  exhausted: boolean;
}

export interface JobProvider<Config = unknown, State = unknown> {
  kind: SourceKindString;
  /**
   * When true, `ingest` in refresh mode calls `fetchPage` in a loop (advancing
   * `paginationState`) until exhausted or a safety cap—used for snapshot
   * boards that slice client-side so one refresh still fills the bucket.
   */
  expandRefreshToAllPages?: boolean;
  fetchPage(
    config: Config,
    paginationState: State | null,
  ): Promise<FetchPageResult>;
}
