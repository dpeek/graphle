import { createBootstrappedSnapshot } from "@dpeek/graphle-bootstrap";
import { siteItemPublicProjectionSpec, siteVisibilityIdFor } from "@dpeek/graphle-module-site";
import type { PublicSiteGraphBaseline } from "@dpeek/graphle-module-site";
import {
  createGraphlePublicSiteRuntime,
  graphleSiteGraphBootstrapOptions,
  graphleSiteGraphDefinitions,
} from "@dpeek/graphle-site-web";
import { describe, expect, it } from "bun:test";

import { CloudflarePublicSitePublishError, publishPublicSiteBaseline } from "./publish.js";
import {
  fetchCloudflarePublicSite,
  GraphlePublicSiteBaselineDurableObject,
  graphlePublicSiteBaselinePath,
  type CloudflarePublicSiteWorkerEnv,
  type DurableObjectNamespaceLike,
  type DurableObjectStateLike,
  type DurableObjectStorageLike,
  type FetcherLike,
} from "./worker.js";

class MemoryDurableObjectStorage implements DurableObjectStorageLike {
  readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }
}

class MemoryDurableObjectNamespace implements DurableObjectNamespaceLike {
  readonly object: FetcherLike;

  constructor(state: DurableObjectStateLike, env: Record<string, string | undefined>) {
    this.object = new GraphlePublicSiteBaselineDurableObject(state, env);
  }

  idFromName(name: string): string {
    return name;
  }

  get(): FetcherLike {
    return this.object;
  }
}

function createWorkerEnv(
  options: {
    readonly secret?: string;
    readonly assets?: FetcherLike;
    readonly scripts?: string;
    readonly styles?: string;
  } = {},
): CloudflarePublicSiteWorkerEnv {
  const secret = options.secret ?? "deploy-secret";
  const storage = new MemoryDurableObjectStorage();
  const objectEnv = {
    GRAPHLE_DEPLOY_SECRET: secret,
    GRAPHLE_PUBLIC_SITE_SCRIPTS: options.scripts,
    GRAPHLE_PUBLIC_SITE_STYLES: options.styles,
  };

  return {
    PUBLIC_SITE_BASELINE: new MemoryDurableObjectNamespace({ storage }, objectEnv),
    GRAPHLE_DEPLOY_SECRET: secret,
    GRAPHLE_PUBLIC_SITE_SCRIPTS: options.scripts,
    GRAPHLE_PUBLIC_SITE_STYLES: options.styles,
    ...(options.assets ? { ASSETS: options.assets } : {}),
  };
}

function createTestBaseline(): PublicSiteGraphBaseline {
  const runtime = createGraphlePublicSiteRuntime(
    createBootstrappedSnapshot(graphleSiteGraphDefinitions, graphleSiteGraphBootstrapOptions),
  );
  const graphleTag = runtime.graph.tag.create({
    color: "#2563eb",
    key: "graphle",
    name: "Graphle",
  });

  runtime.graph.item.create({
    title: "Home",
    path: "/",
    body: "# Home\n\nWelcome to **cloud** rendering.",
    visibility: siteVisibilityIdFor("public"),
    tags: [graphleTag],
    sortOrder: 0,
    createdAt: new Date("2026-04-18T00:00:00.000Z"),
    updatedAt: new Date("2026-04-18T00:00:00.000Z"),
  });
  runtime.graph.item.create({
    title: "Cloud note",
    path: "/notes/cloud",
    body: "# Cloud note\n\nRendered from a projected graph baseline.",
    visibility: siteVisibilityIdFor("public"),
    tags: [graphleTag],
    sortOrder: 1,
    createdAt: new Date("2026-04-17T00:00:00.000Z"),
    updatedAt: new Date("2026-04-18T00:00:00.000Z"),
  });
  runtime.graph.item.create({
    title: "External resource",
    url: new URL("https://example.com/resource"),
    visibility: siteVisibilityIdFor("public"),
    tags: [],
    sortOrder: 2,
    createdAt: new Date("2026-04-16T00:00:00.000Z"),
    updatedAt: new Date("2026-04-18T00:00:00.000Z"),
  });

  return {
    projectionId: siteItemPublicProjectionSpec.projectionId,
    definitionHash: siteItemPublicProjectionSpec.definitionHash,
    sourceCursor: "cursor:test",
    baselineHash: "sha256:0000000000000000000000000000000000000000000000000000000000000001",
    generatedAt: "2026-04-18T00:00:00.000Z",
    snapshot: runtime.store.snapshot(),
  };
}

function createLeakyBaseline(): PublicSiteGraphBaseline {
  const runtime = createGraphlePublicSiteRuntime(
    createBootstrappedSnapshot(graphleSiteGraphDefinitions, graphleSiteGraphBootstrapOptions),
  );
  const publicTag = runtime.graph.tag.create({
    color: "#2563eb",
    key: "public",
    name: "Public",
  });
  const privateTag = runtime.graph.tag.create({
    color: "#991b1b",
    key: "private-only",
    name: "Private Only",
  });

  runtime.graph.item.create({
    title: "Public",
    path: "/",
    visibility: siteVisibilityIdFor("public"),
    tags: [publicTag],
  });
  runtime.graph.item.create({
    title: "Private draft",
    path: "/private",
    visibility: siteVisibilityIdFor("private"),
    tags: [privateTag],
  });

  return {
    projectionId: siteItemPublicProjectionSpec.projectionId,
    definitionHash: siteItemPublicProjectionSpec.definitionHash,
    sourceCursor: "cursor:leaky",
    baselineHash: "sha256:0000000000000000000000000000000000000000000000000000000000000002",
    generatedAt: "2026-04-18T00:00:00.000Z",
    snapshot: runtime.store.snapshot(),
  };
}

function createUnreferencedTagBaseline(): PublicSiteGraphBaseline {
  const runtime = createGraphlePublicSiteRuntime(
    createBootstrappedSnapshot(graphleSiteGraphDefinitions, graphleSiteGraphBootstrapOptions),
  );
  const publicTag = runtime.graph.tag.create({
    color: "#2563eb",
    key: "public",
    name: "Public",
  });
  runtime.graph.tag.create({
    color: "#991b1b",
    key: "private-only",
    name: "Private Only",
  });

  runtime.graph.item.create({
    title: "Public",
    path: "/",
    visibility: siteVisibilityIdFor("public"),
    tags: [publicTag],
  });

  return {
    projectionId: siteItemPublicProjectionSpec.projectionId,
    definitionHash: siteItemPublicProjectionSpec.definitionHash,
    sourceCursor: "cursor:unreferenced-tag",
    baselineHash: "sha256:0000000000000000000000000000000000000000000000000000000000000003",
    generatedAt: "2026-04-18T00:00:00.000Z",
    snapshot: runtime.store.snapshot(),
  };
}

async function installBaseline(
  env: CloudflarePublicSiteWorkerEnv,
  baseline = createTestBaseline(),
): Promise<Response> {
  return await fetchCloudflarePublicSite(
    new Request(`https://example.com${graphlePublicSiteBaselinePath}`, {
      method: "PUT",
      headers: {
        authorization: "Bearer deploy-secret",
        "content-type": "application/json",
      },
      body: JSON.stringify(baseline),
    }),
    env,
  );
}

describe("Cloudflare public site worker", () => {
  it("reports health and keeps unknown api routes as no-store JSON 404s", async () => {
    const env = createWorkerEnv();
    const health = await fetchCloudflarePublicSite(
      new Request("https://example.com/api/health"),
      env,
    );
    const missing = await fetchCloudflarePublicSite(
      new Request("https://example.com/api/missing"),
      env,
    );

    expect(health.status).toBe(200);
    expect(health.headers.get("cache-control")).toBe("no-store");
    expect(await health.json()).toMatchObject({
      ok: true,
      service: {
        name: "graphle-public-site",
        status: "ok",
      },
      baseline: {
        status: "missing",
      },
    });
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
    expect(await missing.json()).toEqual({
      error: 'API route "/api/missing" was not found.',
      code: "not-found",
    });
  });

  it("protects baseline replacement and rejects incompatible projection metadata", async () => {
    const env = createWorkerEnv();
    const unauthorized = await fetchCloudflarePublicSite(
      new Request(`https://example.com${graphlePublicSiteBaselinePath}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(createTestBaseline()),
      }),
      env,
    );
    const incompatible = await installBaseline(env, {
      ...createTestBaseline(),
      definitionHash: "projection-def:site:item:public-graph:v0",
    });
    const leaky = await installBaseline(env, createLeakyBaseline());
    const unreferencedTag = await installBaseline(env, createUnreferencedTagBaseline());

    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({
      error: "Baseline replacement requires deploy authorization.",
      code: "deploy.unauthorized",
    });
    expect(incompatible.status).toBe(400);
    expect(await incompatible.json()).toMatchObject({
      code: "baseline.invalid",
    });
    expect(leaky.status).toBe(400);
    expect(await leaky.json()).toMatchObject({
      code: "baseline.invalid",
      error: "Public site graph baseline must not contain private site:item records.",
    });
    expect(unreferencedTag.status).toBe(400);
    expect(await unreferencedTag.json()).toMatchObject({
      code: "baseline.invalid",
      error:
        "Public site graph baseline must not contain unreferenced or private-only core:tag records.",
    });
  });

  it("stores a compatible baseline and server-renders public graph routes", async () => {
    const env = createWorkerEnv({
      scripts: "/assets/site.js",
      styles: "/assets/site.css",
    });
    const install = await installBaseline(env);
    const home = await fetchCloudflarePublicSite(new Request("https://example.com/"), env);
    const note = await fetchCloudflarePublicSite(
      new Request("https://example.com/notes/cloud"),
      env,
    );
    const missing = await fetchCloudflarePublicSite(
      new Request("https://example.com/private"),
      env,
    );
    const homeHtml = await home.text();
    const noteHtml = await note.text();
    const missingHtml = await missing.text();

    expect(install.status).toBe(200);
    expect(await install.json()).toMatchObject({
      ok: true,
      baseline: {
        status: "ready",
        baselineHash: "sha256:0000000000000000000000000000000000000000000000000000000000000001",
      },
    });
    expect(home.status).toBe(200);
    expect(home.headers.get("cache-control")).toBe(
      "public, s-maxage=300, max-age=0, must-revalidate",
    );
    expect(home.headers.get("x-graphle-public-baseline-hash")).toBe(
      "sha256:0000000000000000000000000000000000000000000000000000000000000001",
    );
    expect(homeHtml).toContain("<!doctype html>");
    expect(homeHtml).toContain('<link rel="stylesheet" href="/assets/site.css">');
    expect(homeHtml).toContain('<script type="module" src="/assets/site.js"></script>');
    expect(homeHtml).toContain("Home");
    expect(homeHtml).toContain("April 18, 2026");
    expect(homeHtml).toContain('data-graphle-public-preview=""');
    expect(homeHtml).toContain("data-graphle-public-item=");
    expect(homeHtml).toContain("Graphle");
    expect(homeHtml).toContain("<strong>cloud</strong>");
    expect(homeHtml).toContain("External resource");
    expect(homeHtml).toContain("https://example.com/resource");
    expect(homeHtml).not.toContain("Private draft");
    expect(homeHtml).not.toContain("private-only");
    expect(note.status).toBe(200);
    expect(noteHtml).toContain("Cloud note");
    expect(noteHtml).toContain("Rendered from a projected graph baseline.");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe(
      "public, s-maxage=60, max-age=0, must-revalidate",
    );
    expect(missingHtml).toContain("Page not found");
    expect(missingHtml).toContain("External resource");
  });

  it("returns no-store HTML until a public baseline is installed", async () => {
    const env = createWorkerEnv();
    const response = await fetchCloudflarePublicSite(new Request("https://example.com/"), env);
    const html = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(html).toContain("Site unavailable");
    expect(html).toContain("public graph baseline has not been installed");
  });

  it("serves static assets through the asset binding with immutable cache headers", async () => {
    const env = createWorkerEnv({
      assets: {
        fetch: () =>
          new Response("console.log('asset');", {
            headers: {
              "content-type": "application/javascript; charset=utf-8",
            },
          }),
      },
    });
    const response = await fetchCloudflarePublicSite(
      new Request("https://example.com/assets/main.js"),
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("content-type")).toBe("application/javascript; charset=utf-8");
    expect(await response.text()).toBe("console.log('asset');");
  });
});

describe("Cloudflare public site publish handoff", () => {
  it("replaces the baseline, verifies health and home, and exposes purge paths", async () => {
    const baseline = createTestBaseline();
    const requested: string[] = [];
    const purged: readonly string[][] = [];

    const result = await publishPublicSiteBaseline({
      workerUrl: "https://worker.example.com",
      baseline,
      deploySecret: "deploy-secret",
      fetch: async (input, init) => {
        const request = new Request(input, init);
        requested.push(`${request.method} ${new URL(request.url).pathname}`);
        if (new URL(request.url).pathname === graphlePublicSiteBaselinePath) {
          expect(request.headers.get("authorization")).toBe("Bearer deploy-secret");
        }
        return Response.json({ ok: true });
      },
      purgePaths(paths) {
        purged.push([...paths]);
      },
    });

    expect(requested).toEqual(["PUT /api/baseline", "GET /api/health", "GET /"]);
    expect(result).toEqual({
      baselineHash: baseline.baselineHash,
      healthStatus: 200,
      homeStatus: 200,
      paths: ["/", "/notes/cloud"],
    });
    expect(purged).toEqual([["/", "/notes/cloud"]]);
  });

  it("retries baseline replacement while workers.dev serves the previous Worker", async () => {
    const baseline = createTestBaseline();
    const requested: string[] = [];
    const slept: number[] = [];
    let replaceAttempts = 0;

    const result = await publishPublicSiteBaseline({
      workerUrl: "https://worker.example.com",
      baseline,
      deploySecret: "deploy-secret",
      retryDelaysMs: [0],
      sleep(delayMs) {
        slept.push(delayMs);
      },
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const pathname = new URL(request.url).pathname;
        requested.push(`${request.method} ${pathname}`);

        if (pathname === graphlePublicSiteBaselinePath) {
          replaceAttempts += 1;
          if (replaceAttempts === 1) {
            return Response.json(
              {
                error: "Baseline replacement requires deploy authorization.",
                code: "deploy.unauthorized",
              },
              { status: 401 },
            );
          }
        }

        return Response.json({ ok: true });
      },
    });

    expect(result.baselineHash).toBe(baseline.baselineHash);
    expect(slept).toEqual([0]);
    expect(requested).toEqual([
      "PUT /api/baseline",
      "PUT /api/baseline",
      "GET /api/health",
      "GET /",
    ]);
  });

  it("reports final baseline replacement status and body without leaking secrets", async () => {
    const baseline = createTestBaseline();

    try {
      await publishPublicSiteBaseline({
        workerUrl: "https://worker.example.com",
        baseline,
        deploySecret: "deploy-secret",
        retryDelaysMs: [],
        fetch: async () =>
          new Response("bad baseline for deploy-secret", {
            status: 400,
            statusText: "Bad Request",
          }),
      });
      throw new Error("Expected publish to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(CloudflarePublicSitePublishError);
      expect(error).toMatchObject({
        code: "baseline.replace_failed",
        status: 400,
        retryable: false,
      });
      expect((error as Error).message).toContain("HTTP 400 Bad Request");
      expect((error as Error).message).toContain("bad baseline for [redacted]");
      expect((error as Error).message).not.toContain("deploy-secret");
    }
  });
});
