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
  fetchPage(
    config: Config,
    paginationState: State | null,
  ): Promise<FetchPageResult>;
}
