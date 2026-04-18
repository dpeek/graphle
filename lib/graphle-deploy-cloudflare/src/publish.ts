import type { PublicSiteGraphBaseline } from "@dpeek/graphle-module-site";
import {
  createGraphlePublicSiteRuntimeFromBaseline,
  listGraphleSiteItemViews,
} from "@dpeek/graphle-site-web";

import { graphlePublicSiteBaselinePath, graphlePublicSiteHealthPath } from "./worker.js";

export class CloudflarePublicSitePublishError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "CloudflarePublicSitePublishError";
    this.code = code;
    this.status = status;
  }
}

export interface PublishPublicSiteBaselineOptions {
  readonly workerUrl: string | URL;
  readonly baseline: PublicSiteGraphBaseline;
  readonly deploySecret: string;
  readonly fetch?: typeof fetch;
  readonly purgePaths?: (paths: readonly string[]) => Promise<void> | void;
}

export interface PublishPublicSiteBaselineResult {
  readonly baselineHash: string;
  readonly paths: readonly string[];
  readonly healthStatus: number;
  readonly homeStatus: number;
}

function workerEndpoint(workerUrl: string | URL, pathname: string): URL {
  const endpoint = new URL(workerUrl);
  endpoint.pathname = pathname;
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint;
}

async function requireOk(response: Response, code: string, message: string): Promise<void> {
  if (response.ok) return;

  throw new CloudflarePublicSitePublishError(message, code, response.status);
}

export function listPublicSiteBaselineCachePaths(
  baseline: PublicSiteGraphBaseline,
): readonly string[] {
  const runtime = createGraphlePublicSiteRuntimeFromBaseline(baseline);
  const paths = new Set<string>(["/"]);

  for (const item of listGraphleSiteItemViews(runtime)) {
    if (item.path) paths.add(item.path);
  }

  return [...paths].sort((left, right) => {
    if (left === "/") return -1;
    if (right === "/") return 1;
    return left.localeCompare(right);
  });
}

export async function publishPublicSiteBaseline({
  workerUrl,
  baseline,
  deploySecret,
  fetch: fetcher = fetch,
  purgePaths,
}: PublishPublicSiteBaselineOptions): Promise<PublishPublicSiteBaselineResult> {
  const paths = listPublicSiteBaselineCachePaths(baseline);
  const replace = await fetcher(workerEndpoint(workerUrl, graphlePublicSiteBaselinePath), {
    method: "PUT",
    headers: {
      authorization: `Bearer ${deploySecret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(baseline),
  });
  await requireOk(
    replace,
    "baseline.replace_failed",
    "Cloudflare public baseline replacement failed.",
  );

  await purgePaths?.(paths);

  const health = await fetcher(workerEndpoint(workerUrl, graphlePublicSiteHealthPath));
  await requireOk(health, "health.failed", "Cloudflare public site health verification failed.");

  const home = await fetcher(workerEndpoint(workerUrl, "/"), {
    headers: {
      "cache-control": "no-cache",
    },
  });
  await requireOk(home, "home.failed", "Cloudflare public home route verification failed.");

  return {
    baselineHash: baseline.baselineHash,
    paths,
    healthStatus: health.status,
    homeStatus: home.status,
  };
}
