import {
  assertPublicSiteGraphBaselineCompatible,
  isPublicSiteGraphBaselineCompatible,
  siteVisibilityForId,
  type PublicSiteGraphBaseline,
} from "@dpeek/graphle-module-site";
import {
  createGraphlePublicSiteRuntimeFromBaseline,
  renderPublicSiteRoute,
  type RenderedPublicSiteRoute,
} from "@dpeek/graphle-site-web";

export const graphlePublicSiteBaselineObjectName = "public-site-baseline";
export const graphlePublicSiteBaselineStorageKey = "graphle.public-site.baseline";
export const graphlePublicSiteBaselinePath = "/api/baseline";
export const graphlePublicSiteHealthPath = "/api/health";

export type FetcherLike = {
  fetch(request: Request): Promise<Response> | Response;
};

export type DurableObjectNamespaceLike = {
  idFromName(name: string): unknown;
  get(id: unknown): FetcherLike;
};

export type DurableObjectStorageLike = {
  get<T>(key: string): Promise<T | undefined> | T | undefined;
  put<T>(key: string, value: T): Promise<void> | void;
};

export type DurableObjectStateLike = {
  readonly storage: DurableObjectStorageLike;
};

export interface CloudflarePublicSiteWorkerEnv {
  readonly PUBLIC_SITE_BASELINE: DurableObjectNamespaceLike;
  readonly ASSETS?: FetcherLike;
  readonly GRAPHLE_DEPLOY_SECRET?: string;
  readonly GRAPHLE_PUBLIC_CACHE_VERSION?: string;
  readonly GRAPHLE_PUBLIC_SITE_SCRIPTS?: string;
  readonly GRAPHLE_PUBLIC_SITE_STYLES?: string;
}

export interface CloudflarePublicSiteDurableObjectEnv {
  readonly GRAPHLE_DEPLOY_SECRET?: string;
  readonly GRAPHLE_PUBLIC_CACHE_VERSION?: string;
  readonly GRAPHLE_PUBLIC_SITE_SCRIPTS?: string;
  readonly GRAPHLE_PUBLIC_SITE_STYLES?: string;
}

function jsonResponse(
  payload: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function methodNotAllowed(allow: string): Response {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: {
      allow,
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

function apiNotFound(pathname: string): Response {
  return jsonResponse(
    {
      error: `API route "${pathname}" was not found.`,
      code: "not-found",
    },
    404,
  );
}

function isStaticAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/assets/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest"
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderPublicSiteDocument(
  baseline: PublicSiteGraphBaseline,
  rendered: RenderedPublicSiteRoute,
  env: CloudflarePublicSiteDurableObjectEnv,
): string {
  const assetTags = renderConfiguredAssetTags(env);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="graphle-public-baseline-hash" content="${escapeHtml(baseline.baselineHash)}">
    <title>${escapeHtml(rendered.title)}</title>
${assetTags}
  </head>
  <body>
    <div id="root">${rendered.html}</div>
  </body>
</html>`;
}

function parseConfiguredAssetList(value: string | undefined): readonly string[] {
  if (!value) return [];

  const trimmed = value.trim();
  if (trimmed.length === 0) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        return parsed;
      }
    } catch {
      return [];
    }
  }

  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function renderConfiguredAssetTags(env: CloudflarePublicSiteDurableObjectEnv): string {
  const styles = parseConfiguredAssetList(env.GRAPHLE_PUBLIC_SITE_STYLES).map(
    (href) => `    <link rel="stylesheet" href="${escapeHtml(href)}">`,
  );
  const scripts = parseConfiguredAssetList(env.GRAPHLE_PUBLIC_SITE_SCRIPTS).map(
    (src) => `    <script type="module" src="${escapeHtml(src)}"></script>`,
  );

  return [...styles, ...scripts].join("\n");
}

function renderBaselineUnavailableDocument(message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Site unavailable</title>
  </head>
  <body>
    <main>
      <h1>Site unavailable</h1>
      <p>${escapeHtml(message)}</p>
    </main>
  </body>
</html>`;
}

function publicHtmlCacheControl(): string {
  return "public, s-maxage=300, max-age=0, must-revalidate";
}

function missingHtmlCacheControl(): string {
  return "public, s-maxage=60, max-age=0, must-revalidate";
}

function cloneBaseline(baseline: PublicSiteGraphBaseline): PublicSiteGraphBaseline {
  return JSON.parse(JSON.stringify(baseline)) as PublicSiteGraphBaseline;
}

function hasDeployAuthorization(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;

  const authorization = request.headers.get("authorization");
  if (authorization === `Bearer ${secret}`) return true;

  return request.headers.get("x-graphle-deploy-secret") === secret;
}

function baselineSummary(baseline: PublicSiteGraphBaseline | undefined) {
  if (!baseline) {
    return {
      status: "missing" as const,
    };
  }

  return {
    status: isPublicSiteGraphBaselineCompatible(baseline)
      ? ("ready" as const)
      : ("incompatible" as const),
    projectionId: baseline.projectionId,
    definitionHash: baseline.definitionHash,
    sourceCursor: baseline.sourceCursor,
    baselineHash: baseline.baselineHash,
    generatedAt: baseline.generatedAt,
  };
}

function baselineInputError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Baseline payload is invalid.";
  return jsonResponse(
    {
      error: message,
      code: "baseline.invalid",
    },
    400,
  );
}

async function readJsonBaseline(request: Request): Promise<PublicSiteGraphBaseline> {
  const baseline = (await request.json()) as PublicSiteGraphBaseline;
  assertPublicSiteGraphBaselineCompatible(baseline);
  if (!baseline.snapshot || !Array.isArray(baseline.snapshot.edges)) {
    throw new Error("Public site graph baseline snapshot is missing or invalid.");
  }
  validateSanitizedPublicBaseline(baseline);
  return baseline;
}

function validateSanitizedPublicBaseline(baseline: PublicSiteGraphBaseline): void {
  const runtime = createGraphlePublicSiteRuntimeFromBaseline(baseline);
  const referencedTagIds = new Set<string>();

  for (const item of runtime.graph.item.list()) {
    if (siteVisibilityForId(item.visibility) !== "public") {
      throw new Error("Public site graph baseline must not contain private site:item records.");
    }
    for (const tagId of item.tags ?? []) {
      referencedTagIds.add(tagId);
    }
  }

  for (const tag of runtime.graph.tag.list()) {
    if (!referencedTagIds.has(tag.id)) {
      throw new Error(
        "Public site graph baseline must not contain unreferenced or private-only core:tag records.",
      );
    }
  }
}

async function fetchStaticAsset(
  request: Request,
  env: CloudflarePublicSiteWorkerEnv,
): Promise<Response | undefined> {
  if (!env.ASSETS) return undefined;

  const response = await env.ASSETS.fetch(request);
  if (response.status === 404) {
    return new Response(response.body, {
      status: 404,
      headers: {
        "cache-control": "no-store",
        "content-type": response.headers.get("content-type") ?? "text/plain; charset=utf-8",
      },
    });
  }
  if (!response.ok) return response;

  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export class GraphlePublicSiteBaselineDurableObject {
  readonly #state: DurableObjectStateLike;
  readonly #env: CloudflarePublicSiteDurableObjectEnv;

  constructor(state: DurableObjectStateLike, env: CloudflarePublicSiteDurableObjectEnv = {}) {
    this.#state = state;
    this.#env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === graphlePublicSiteHealthPath) {
      if (request.method !== "GET") return methodNotAllowed("GET");

      return jsonResponse({
        ok: true,
        service: {
          name: "graphle-public-site",
          status: "ok",
        },
        baseline: baselineSummary(await this.#readBaseline()),
      });
    }

    if (url.pathname === graphlePublicSiteBaselinePath) {
      if (request.method !== "PUT" && request.method !== "POST") {
        return methodNotAllowed("PUT, POST");
      }
      if (!hasDeployAuthorization(request, this.#env.GRAPHLE_DEPLOY_SECRET)) {
        return jsonResponse(
          {
            error: "Baseline replacement requires deploy authorization.",
            code: "deploy.unauthorized",
          },
          this.#env.GRAPHLE_DEPLOY_SECRET ? 401 : 503,
        );
      }

      let baseline: PublicSiteGraphBaseline;
      try {
        baseline = await readJsonBaseline(request);
      } catch (error) {
        return baselineInputError(error);
      }

      await this.#state.storage.put(graphlePublicSiteBaselineStorageKey, cloneBaseline(baseline));
      return jsonResponse({
        ok: true,
        baseline: baselineSummary(baseline),
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return apiNotFound(url.pathname);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return methodNotAllowed("GET, HEAD");
    }

    return await this.#renderPublicRoute(request, url.pathname);
  }

  async #readBaseline(): Promise<PublicSiteGraphBaseline | undefined> {
    return await this.#state.storage.get<PublicSiteGraphBaseline>(
      graphlePublicSiteBaselineStorageKey,
    );
  }

  async #renderPublicRoute(request: Request, path: string): Promise<Response> {
    const baseline = await this.#readBaseline();
    if (!baseline) {
      return new Response(
        request.method === "HEAD"
          ? null
          : renderBaselineUnavailableDocument(
              "The projected public graph baseline has not been installed yet.",
            ),
        {
          status: 503,
          headers: {
            "cache-control": "no-store",
            "content-type": "text/html; charset=utf-8",
          },
        },
      );
    }

    let rendered: RenderedPublicSiteRoute;
    try {
      const runtime = createGraphlePublicSiteRuntimeFromBaseline(baseline);
      rendered = renderPublicSiteRoute({ runtime, path });
    } catch {
      return new Response(
        request.method === "HEAD"
          ? null
          : renderBaselineUnavailableDocument(
              "The installed public graph baseline is incompatible with this Worker.",
            ),
        {
          status: 503,
          headers: {
            "cache-control": "no-store",
            "content-type": "text/html; charset=utf-8",
          },
        },
      );
    }

    return new Response(
      request.method === "HEAD" ? null : renderPublicSiteDocument(baseline, rendered, this.#env),
      {
        status: rendered.status,
        headers: {
          "cache-control":
            rendered.status === 404 ? missingHtmlCacheControl() : publicHtmlCacheControl(),
          "content-type": "text/html; charset=utf-8",
          etag: `"${baseline.baselineHash}"`,
          "x-graphle-public-baseline-hash": baseline.baselineHash,
        },
      },
    );
  }
}

function publicSiteBaselineObject(env: CloudflarePublicSiteWorkerEnv): FetcherLike {
  const objectId = env.PUBLIC_SITE_BASELINE.idFromName(graphlePublicSiteBaselineObjectName);
  return env.PUBLIC_SITE_BASELINE.get(objectId);
}

export async function fetchCloudflarePublicSite(
  request: Request,
  env: CloudflarePublicSiteWorkerEnv,
): Promise<Response> {
  const url = new URL(request.url);

  if (isStaticAssetPath(url.pathname)) {
    const asset = await fetchStaticAsset(request, env);
    if (asset) return asset;
  }

  return await publicSiteBaselineObject(env).fetch(request);
}

export default {
  fetch: fetchCloudflarePublicSite,
};
