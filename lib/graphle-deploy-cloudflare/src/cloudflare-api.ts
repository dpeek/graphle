import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CloudflareDeployError,
  redactCloudflareDeploySecrets,
  type ValidatedCloudflareDeployInput,
} from "./contracts.js";

export const cloudflareApiBaseUrl = "https://api.cloudflare.com/client/v4";
export const cloudflarePublicSiteWorkerMainModule = "graphle-public-site-worker.js";
export const cloudflarePublicSiteWorkerCompatibilityDate = "2026-04-18";
export const cloudflarePublicSiteDurableObjectBindingName = "PUBLIC_SITE_BASELINE";
export const cloudflarePublicSiteDurableObjectClassName = "GraphlePublicSiteBaselineDurableObject";
export const cloudflarePublicSiteDurableObjectMigrationTag = "graphle-public-site-baseline-v1";

export interface CloudflareWorkerBundle {
  readonly mainModule: string;
  readonly source: string;
}

export interface CloudflareApiClientOptions {
  readonly accountId: string;
  readonly apiToken: string;
  readonly apiBaseUrl?: string;
  readonly fetch?: typeof fetch;
}

export interface ProvisionCloudflarePublicSiteWorkerOptions {
  readonly input: ValidatedCloudflareDeployInput;
  readonly deploySecret: string;
  readonly workerBundle?: CloudflareWorkerBundle;
  readonly apiBaseUrl?: string;
  readonly fetch?: typeof fetch;
}

export interface ProvisionCloudflarePublicSiteWorkerResult {
  readonly workerName: string;
  readonly workerUrl: string;
  readonly durableObjectBinding: string;
  readonly durableObjectClass: string;
  readonly migrationTag: string;
  readonly uploaded: boolean;
}

type CloudflareEnvelope<T> = {
  readonly success?: boolean;
  readonly result?: T;
  readonly errors?: readonly { readonly code?: number | string; readonly message?: string }[];
  readonly messages?: readonly { readonly code?: number | string; readonly message?: string }[];
};

type CloudflareScriptSummary = {
  readonly id?: string;
  readonly script_name?: string;
  readonly migration_tag?: string;
};

type CloudflareSubdomainResult = {
  readonly subdomain?: string;
};

type CloudflareWorkerSubdomainResult = {
  readonly enabled?: boolean;
  readonly previews_enabled?: boolean;
};

function encodedPathPart(value: string): string {
  return encodeURIComponent(value);
}

function firstCloudflareMessage(payload: CloudflareEnvelope<unknown> | undefined): string {
  const entries = [...(payload?.errors ?? []), ...(payload?.messages ?? [])];
  return (
    entries
      .map((entry) => entry.message)
      .find((message): message is string => typeof message === "string" && message.length > 0) ??
    "Cloudflare API request failed."
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

async function parseEnvelope<T>(
  response: Response,
  apiToken: string,
): Promise<CloudflareEnvelope<T>> {
  const payload = (await response.json().catch(() => undefined)) as
    | CloudflareEnvelope<T>
    | undefined;
  if (!response.ok || payload?.success === false) {
    const message = redactCloudflareDeploySecrets(firstCloudflareMessage(payload), [apiToken]);
    throw new CloudflareDeployError(message, "cloudflare.api_failed", {
      status: response.status,
      retryable: response.status === 429 || response.status >= 500,
    });
  }
  return payload ?? {};
}

function createRequestHeaders(apiToken: string, contentType?: string): Headers {
  const headers = new Headers({
    accept: "application/json",
    authorization: `Bearer ${apiToken}`,
  });
  if (contentType) headers.set("content-type", contentType);
  return headers;
}

function metadataBindingValues(deploySecret: string) {
  return [
    {
      name: cloudflarePublicSiteDurableObjectBindingName,
      type: "durable_object_namespace",
      class_name: cloudflarePublicSiteDurableObjectClassName,
    },
    {
      name: "GRAPHLE_DEPLOY_SECRET",
      type: "secret_text",
      text: deploySecret,
    },
  ];
}

export function createCloudflarePublicSiteWorkerUploadMetadata({
  deploySecret,
  includeDurableObjectMigration,
}: {
  readonly deploySecret: string;
  readonly includeDurableObjectMigration: boolean;
}) {
  return {
    main_module: cloudflarePublicSiteWorkerMainModule,
    compatibility_date: cloudflarePublicSiteWorkerCompatibilityDate,
    bindings: metadataBindingValues(deploySecret),
    ...(includeDurableObjectMigration
      ? {
          migrations: {
            new_tag: cloudflarePublicSiteDurableObjectMigrationTag,
            new_sqlite_classes: [cloudflarePublicSiteDurableObjectClassName],
          },
        }
      : {}),
  };
}

export function createCloudflareWorkerUploadFormData({
  bundle,
  deploySecret,
  includeDurableObjectMigration,
}: {
  readonly bundle: CloudflareWorkerBundle;
  readonly deploySecret: string;
  readonly includeDurableObjectMigration: boolean;
}): FormData {
  const form = new FormData();
  form.append(
    "metadata",
    JSON.stringify(
      createCloudflarePublicSiteWorkerUploadMetadata({
        deploySecret,
        includeDurableObjectMigration,
      }),
    ),
  );
  form.append(
    bundle.mainModule,
    new Blob([bundle.source], { type: "application/javascript+module" }),
    bundle.mainModule,
  );
  return form;
}

async function existingWorkerEntrypoint(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, "worker.ts"), join(here, "worker.js")];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new CloudflareDeployError(
    "The Cloudflare public site Worker entrypoint was not found.",
    "worker.entrypoint_missing",
  );
}

export async function buildCloudflarePublicSiteWorkerBundle(): Promise<CloudflareWorkerBundle> {
  if (!("Bun" in globalThis)) {
    throw new CloudflareDeployError(
      "Cloudflare Worker bundle generation requires the Bun runtime.",
      "worker.bundle_runtime_missing",
    );
  }

  const result = await Bun.build({
    entrypoints: [await existingWorkerEntrypoint()],
    format: "esm",
    minify: true,
    target: "browser",
  });

  if (!result.success || !result.outputs[0]) {
    const message = result.logs.map((entry) => entry.message).join(" ");
    throw new CloudflareDeployError(
      message || "Cloudflare Worker bundle generation failed.",
      "worker.bundle_failed",
    );
  }

  return {
    mainModule: cloudflarePublicSiteWorkerMainModule,
    source: await result.outputs[0].text(),
  };
}

export function createCloudflareApiClient({
  accountId,
  apiToken,
  apiBaseUrl = cloudflareApiBaseUrl,
  fetch: fetcher = fetch,
}: CloudflareApiClientOptions) {
  function endpoint(path: string): string {
    return `${apiBaseUrl}/accounts/${encodedPathPart(accountId)}${path}`;
  }

  async function jsonRequest<T>(path: string, init: Omit<RequestInit, "headers"> = {}): Promise<T> {
    const response = await fetcher(endpoint(path), {
      ...init,
      headers: createRequestHeaders(apiToken, "application/json"),
    });
    const envelope = await parseEnvelope<T>(response, apiToken);
    return envelope.result as T;
  }

  async function listWorkerScripts(): Promise<readonly CloudflareScriptSummary[]> {
    const result = await jsonRequest<readonly CloudflareScriptSummary[]>("/workers/scripts");
    return Array.isArray(result) ? result : [];
  }

  async function uploadWorkerModule({
    deploySecret,
    existingMigrationTag,
    workerBundle,
    workerName,
  }: {
    readonly deploySecret: string;
    readonly existingMigrationTag?: string;
    readonly workerBundle: CloudflareWorkerBundle;
    readonly workerName: string;
  }): Promise<CloudflareScriptSummary> {
    const form = createCloudflareWorkerUploadFormData({
      bundle: workerBundle,
      deploySecret,
      includeDurableObjectMigration:
        existingMigrationTag !== cloudflarePublicSiteDurableObjectMigrationTag,
    });
    const response = await fetcher(endpoint(`/workers/scripts/${encodedPathPart(workerName)}`), {
      method: "PUT",
      headers: createRequestHeaders(apiToken),
      body: form,
    });
    const envelope = await parseEnvelope<CloudflareScriptSummary>(response, apiToken);
    return isObjectRecord(envelope.result) ? envelope.result : {};
  }

  async function enableWorkerSubdomain(
    workerName: string,
  ): Promise<CloudflareWorkerSubdomainResult> {
    return await jsonRequest<CloudflareWorkerSubdomainResult>(
      `/workers/scripts/${encodedPathPart(workerName)}/subdomain`,
      {
        method: "POST",
        body: JSON.stringify({
          enabled: true,
          previews_enabled: false,
        }),
      },
    );
  }

  async function getAccountSubdomain(): Promise<string> {
    const result = await jsonRequest<CloudflareSubdomainResult>("/workers/subdomain");
    if (!result?.subdomain) {
      throw new CloudflareDeployError(
        "Cloudflare account does not have a workers.dev subdomain configured.",
        "cloudflare.subdomain_missing",
        { status: 400 },
      );
    }
    return result.subdomain;
  }

  return {
    listWorkerScripts,
    uploadWorkerModule,
    enableWorkerSubdomain,
    getAccountSubdomain,
  };
}

export async function provisionCloudflarePublicSiteWorker({
  input,
  deploySecret,
  workerBundle,
  apiBaseUrl,
  fetch: fetcher,
}: ProvisionCloudflarePublicSiteWorkerOptions): Promise<ProvisionCloudflarePublicSiteWorkerResult> {
  const bundle = workerBundle ?? (await buildCloudflarePublicSiteWorkerBundle());
  const client = createCloudflareApiClient({
    accountId: input.accountId,
    apiToken: input.apiToken,
    apiBaseUrl,
    fetch: fetcher,
  });
  const existing = (await client.listWorkerScripts()).find(
    (script) => script.id === input.workerName || script.script_name === input.workerName,
  );
  const uploaded = await client.uploadWorkerModule({
    deploySecret,
    existingMigrationTag: existing?.migration_tag,
    workerBundle: bundle,
    workerName: input.workerName,
  });
  await client.enableWorkerSubdomain(input.workerName);
  const subdomain = await client.getAccountSubdomain();

  return {
    workerName: input.workerName,
    workerUrl: `https://${input.workerName}.${subdomain}.workers.dev`,
    durableObjectBinding: cloudflarePublicSiteDurableObjectBindingName,
    durableObjectClass: cloudflarePublicSiteDurableObjectClassName,
    migrationTag:
      uploaded.migration_tag ??
      existing?.migration_tag ??
      cloudflarePublicSiteDurableObjectMigrationTag,
    uploaded: true,
  };
}
