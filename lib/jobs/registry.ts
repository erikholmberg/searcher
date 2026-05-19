import type { JobProvider } from "@/lib/jobs/types";
import type { SourceKindString } from "@/lib/types";
import { arbeitnowProvider } from "@/lib/jobs/providers/arbeitnow";
import { remotiveProvider } from "@/lib/jobs/providers/remotive";
import { adzunaProvider } from "@/lib/jobs/providers/adzuna";
import { greenhouseProvider } from "@/lib/jobs/providers/greenhouse";
import { leverProvider } from "@/lib/jobs/providers/lever";
import { ashbyProvider } from "@/lib/jobs/providers/ashby";
import { publicJobPostingProvider } from "@/lib/jobs/providers/public-job-posting";
import { careersSiteProvider } from "@/lib/jobs/providers/careers-site";

const REGISTRY: Partial<Record<SourceKindString, JobProvider<unknown, unknown>>> = {
  arbeitnow_query: arbeitnowProvider as JobProvider<unknown, unknown>,
  remotive_query: remotiveProvider as JobProvider<unknown, unknown>,
  adzuna_query: adzunaProvider as JobProvider<unknown, unknown>,
  greenhouse_board: greenhouseProvider as JobProvider<unknown, unknown>,
  lever_board: leverProvider as JobProvider<unknown, unknown>,
  ashby_board: ashbyProvider as JobProvider<unknown, unknown>,
  public_job_posting: publicJobPostingProvider as JobProvider<unknown, unknown>,
  careers_site: careersSiteProvider as JobProvider<unknown, unknown>,
};

export function getProvider(
  kind: SourceKindString,
): JobProvider<unknown, unknown> | null {
  return REGISTRY[kind] ?? null;
}
