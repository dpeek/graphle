import { createBootstrappedSnapshot } from "@dpeek/graphle-bootstrap";
import { siteItemPublicProjectionSpec, siteVisibilityIdFor } from "@dpeek/graphle-module-site";
import type { PublicSiteGraphBaseline } from "@dpeek/graphle-module-site";
import {
  createGraphlePublicSiteRuntime,
  graphleSiteGraphBootstrapOptions,
  graphleSiteGraphDefinitions,
} from "@dpeek/graphle-site-web";
import { describe, expect, it } from "bun:test";

import {
  buildCloudflarePublicSiteWorkerBundle,
  cloudflarePublicSiteDurableObjectBindingName,
  cloudflarePublicSiteDurableObjectClassName,
  cloudflarePublicSiteDurableObjectMigrationTag,
  cloudflarePublicSiteWorkerCompatibilityDate,
  cloudflarePublicSiteWorkerMainModule,
  createCloudflarePublicSiteWorkerUploadMetadata,
  createCloudflareWorkerUploadFormData,
} from "./cloudflare-api.js";
import {
  deriveCloudflareWorkerName,
  redactCloudflareDeploySecrets,
  sanitizeCloudflareDeployError,
  validateCloudflareDeployInput,
  CloudflareDeployError,
} from "./contracts.js";
import { deployCloudflarePublicSite } from "./deploy.js";
import { parseCloudflareDeployMetadata } from "./metadata.js";
import { graphlePublicSiteBaselinePath, graphlePublicSiteHealthPath } from "./worker.js";

function createTestBaseline(): PublicSiteGraphBaseline {
  const runtime = createGraphlePublicSiteRuntime(
    createBootstrappedSnapshot(graphleSiteGraphDefinitions, graphleSiteGraphBootstrapOptions),
  );

  runtime.graph.item.create({
    title: "Home",
    path: "/",
    body: "# Home",
    visibility: siteVisibilityIdFor("public"),
    tags: [],
  });
  runtime.graph.item.create({
    title: "External link",
    url: new URL("https://example.com/link"),
    visibility: siteVisibilityIdFor("public"),
    tags: [],
  });

  return {
    projectionId: siteItemPublicProjectionSpec.projectionId,
    definitionHash: siteItemPublicProjectionSpec.definitionHash,
    sourceCursor: "cursor:test",
    baselineHash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    generatedAt: "2026-04-18T00:00:00.000Z",
    snapshot: runtime.store.snapshot(),
  };
}

describe("Cloudflare deploy contracts", () => {
  it("validates explicit inputs without leaking token values", () => {
    const missing = validateCloudflareDeployInput({
      projectId: "project-1",
      apiToken: "super-secret-token",
      workerName: "Bad_Name",
    });
    const valid = validateCloudflareDeployInput({
      projectId: "Project_One",
      accountId: "account-1",
      apiToken: "super-secret-token",
    });

    expect(missing.ok).toBe(false);
    expect(JSON.stringify(missing)).not.toContain("super-secret-token");
    expect(missing).toMatchObject({
      issues: [
        {
          field: "accountId",
          code: "required",
        },
        {
          field: "workerName",
          code: "invalid",
        },
      ],
    });
    expect(valid).toMatchObject({
      ok: true,
      value: {
        accountId: "account-1",
        workerName: deriveCloudflareWorkerName("Project_One"),
      },
    });
  });

  it("redacts deploy secrets from sanitized errors", () => {
    const error = new CloudflareDeployError(
      "Cloudflare rejected token super-secret-token.",
      "cloudflare.api_failed",
      { status: 403 },
    );

    expect(redactCloudflareDeploySecrets("value super-secret-token", ["super-secret-token"])).toBe(
      "value [redacted]",
    );
    expect(sanitizeCloudflareDeployError(error, ["super-secret-token"])).toEqual({
      code: "cloudflare.api_failed",
      message: "Cloudflare rejected token [redacted].",
      status: 403,
      retryable: false,
    });
  });

  it("parses complete nonsecret deployment metadata", () => {
    expect(
      parseCloudflareDeployMetadata({
        accountId: "account-1",
        workerName: "graphle-project",
        workerUrl: new URL("https://graphle-project.example.workers.dev"),
        durableObjectBinding: cloudflarePublicSiteDurableObjectBindingName,
        durableObjectClass: cloudflarePublicSiteDurableObjectClassName,
        sourceCursor: "cursor:1",
        baselineHash: "sha256:abc",
        deployedAt: new Date("2026-04-18T00:00:00.000Z"),
        status: "ready",
      }),
    ).toEqual({
      accountId: "account-1",
      workerName: "graphle-project",
      workerUrl: "https://graphle-project.example.workers.dev/",
      durableObjectBinding: cloudflarePublicSiteDurableObjectBindingName,
      durableObjectClass: cloudflarePublicSiteDurableObjectClassName,
      sourceCursor: "cursor:1",
      baselineHash: "sha256:abc",
      deployedAt: "2026-04-18T00:00:00.000Z",
      status: "ready",
    });
  });
});

describe("Cloudflare deploy API requests", () => {
  it("bundles the Worker without pulling in Node-only site-web exports", async () => {
    const bundle = await buildCloudflarePublicSiteWorkerBundle();

    expect(bundle.mainModule).toBe(cloudflarePublicSiteWorkerMainModule);
    expect(bundle.source.length).toBeGreaterThan(0);
    expect(bundle.source).not.toContain("node:url");
    expect(bundle.source).not.toContain('=document.createElement("i")');
  });

  it("builds Worker upload metadata with Durable Object binding and migration", async () => {
    const metadata = createCloudflarePublicSiteWorkerUploadMetadata({
      deploySecret: "deploy-secret",
      includeDurableObjectMigration: true,
    });
    const form = createCloudflareWorkerUploadFormData({
      bundle: {
        mainModule: cloudflarePublicSiteWorkerMainModule,
        source: "export default {};",
      },
      deploySecret: "deploy-secret",
      includeDurableObjectMigration: true,
    });
    const parsed = JSON.parse(String(form.get("metadata"))) as typeof metadata;
    const module = form.get(cloudflarePublicSiteWorkerMainModule);

    expect(metadata).toMatchObject({
      main_module: cloudflarePublicSiteWorkerMainModule,
      compatibility_date: cloudflarePublicSiteWorkerCompatibilityDate,
      bindings: [
        {
          name: cloudflarePublicSiteDurableObjectBindingName,
          type: "durable_object_namespace",
          class_name: cloudflarePublicSiteDurableObjectClassName,
        },
        {
          name: "GRAPHLE_DEPLOY_SECRET",
          type: "secret_text",
          text: "deploy-secret",
        },
      ],
      migrations: {
        new_tag: cloudflarePublicSiteDurableObjectMigrationTag,
        new_sqlite_classes: [cloudflarePublicSiteDurableObjectClassName],
      },
    });
    expect(parsed).toEqual(metadata);
    expect(module).toBeInstanceOf(File);
  });

  it("provisions the Worker, publishes the baseline, and verifies URL-only items", async () => {
    const baseline = createTestBaseline();
    const requests: string[] = [];
    const metadataUploads: unknown[] = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      requests.push(`${request.method} ${url.pathname}`);

      if (url.pathname === "/client/v4/accounts/account-1/workers/scripts") {
        return Response.json({
          success: true,
          result: [],
        });
      }

      if (url.pathname === "/client/v4/accounts/account-1/workers/scripts/graphle-project") {
        const form = await request.formData();
        metadataUploads.push(JSON.parse(String(form.get("metadata"))));
        expect(request.headers.get("authorization")).toBe("Bearer token-1");
        return Response.json({
          success: true,
          result: {
            id: "graphle-project",
            migration_tag: cloudflarePublicSiteDurableObjectMigrationTag,
          },
        });
      }

      if (
        url.pathname === "/client/v4/accounts/account-1/workers/scripts/graphle-project/subdomain"
      ) {
        return Response.json({
          success: true,
          result: {
            enabled: true,
            previews_enabled: false,
          },
        });
      }

      if (url.pathname === "/client/v4/accounts/account-1/workers/subdomain") {
        return Response.json({
          success: true,
          result: {
            subdomain: "example",
          },
        });
      }

      if (url.pathname === graphlePublicSiteBaselinePath) {
        expect(request.headers.get("authorization")).toBe("Bearer deploy-secret");
        return Response.json({ ok: true });
      }

      if (url.pathname === graphlePublicSiteHealthPath) {
        return Response.json({ ok: true });
      }

      if (url.pathname === "/") {
        return new Response("Home External link https://example.com/link");
      }

      return Response.json(
        { success: false, errors: [{ message: "unexpected request" }] },
        {
          status: 500,
        },
      );
    };

    const result = await deployCloudflarePublicSite({
      input: {
        projectId: "project-1",
        accountId: "account-1",
        apiToken: "token-1",
        workerName: "graphle-project",
      },
      baseline,
      fetch: fetcher,
      apiBaseUrl: "https://api.test/client/v4",
      workerBundle: {
        mainModule: cloudflarePublicSiteWorkerMainModule,
        source: "export default {};",
      },
      generateDeploySecret: () => "deploy-secret",
      now: () => new Date("2026-04-18T00:00:00.000Z"),
    });

    expect(requests).toEqual([
      "GET /client/v4/accounts/account-1/workers/scripts",
      "PUT /client/v4/accounts/account-1/workers/scripts/graphle-project",
      "POST /client/v4/accounts/account-1/workers/scripts/graphle-project/subdomain",
      "GET /client/v4/accounts/account-1/workers/subdomain",
      "PUT /api/baseline",
      "GET /api/health",
      "GET /",
      "GET /",
    ]);
    expect(metadataUploads).toHaveLength(1);
    expect(result).toMatchObject({
      ok: true,
      state: "ready",
      metadata: {
        accountId: "account-1",
        workerName: "graphle-project",
        workerUrl: "https://graphle-project.example.workers.dev",
        baselineHash: baseline.baselineHash,
        sourceCursor: "cursor:test",
        deployedAt: "2026-04-18T00:00:00.000Z",
      },
      publish: {
        baselineHash: baseline.baselineHash,
        healthStatus: 200,
        homeStatus: 200,
        paths: ["/"],
      },
    });
  });
});
