import { createHash, randomBytes } from "node:crypto";

import type { CloudflareDeployMetadata } from "./metadata.js";

export const cloudflareAccountIdEnvKey = "CLOUDFLARE_ACCOUNT_ID";
export const cloudflareApiTokenEnvKey = "CLOUDFLARE_API_TOKEN";
export const graphleCloudflareWorkerNameEnvKey = "GRAPHLE_CLOUDFLARE_WORKER_NAME";

export type CloudflareDeployState = "idle" | "checking" | "deploying" | "ready" | "error";

export interface CloudflareDeployInput {
  readonly projectId: string;
  readonly accountId?: string;
  readonly apiToken?: string;
  readonly workerName?: string;
}

export interface CloudflareDeployFieldIssue {
  readonly field: "projectId" | "accountId" | "apiToken" | "workerName";
  readonly code: string;
  readonly message: string;
}

export interface ValidatedCloudflareDeployInput {
  readonly projectId: string;
  readonly accountId: string;
  readonly apiToken: string;
  readonly workerName: string;
}

export type CloudflareDeployInputValidationResult =
  | {
      readonly ok: true;
      readonly value: ValidatedCloudflareDeployInput;
    }
  | {
      readonly ok: false;
      readonly issues: readonly CloudflareDeployFieldIssue[];
    };

export interface CloudflareDeploySanitizedError {
  readonly code: string;
  readonly message: string;
  readonly status?: number;
  readonly retryable: boolean;
}

export interface CloudflareDeployResult {
  readonly ok: true;
  readonly state: "ready";
  readonly metadata: CloudflareDeployMetadata;
  readonly publish: {
    readonly baselineHash: string;
    readonly paths: readonly string[];
    readonly healthStatus: number;
    readonly homeStatus: number;
  };
}

export interface CloudflareDeployStatus {
  readonly state: CloudflareDeployState;
  readonly credentials: {
    readonly accountId?: string;
    readonly workerName?: string;
    readonly hasApiToken: boolean;
    readonly missing: readonly string[];
  };
  readonly metadata: CloudflareDeployMetadata | null;
  readonly currentBaseline?: {
    readonly sourceCursor: string;
    readonly baselineHash: string;
    readonly generatedAt: string;
    readonly matchesLastDeploy: boolean;
  };
  readonly error?: CloudflareDeploySanitizedError;
}

export class CloudflareDeployError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    code: string,
    options: {
      readonly status?: number;
      readonly retryable?: boolean;
      readonly cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "CloudflareDeployError";
    this.code = code;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function slugSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  return normalized || "site";
}

export function deriveCloudflareWorkerName(projectId: string): string {
  const slug = slugSegment(projectId).slice(0, 38).replaceAll(/-+$/g, "") || "site";
  return `graphle-${slug}-${shortHash(projectId)}`;
}

function isValidWorkerName(value: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
}

function fieldIssue(
  field: CloudflareDeployFieldIssue["field"],
  code: string,
  message: string,
): CloudflareDeployFieldIssue {
  return { field, code, message };
}

export function validateCloudflareDeployInput(
  input: CloudflareDeployInput,
): CloudflareDeployInputValidationResult {
  const projectId = trimOptional(input.projectId);
  const accountId = trimOptional(input.accountId);
  const apiToken = trimOptional(input.apiToken);
  const workerName =
    trimOptional(input.workerName) ?? (projectId ? deriveCloudflareWorkerName(projectId) : "");
  const issues: CloudflareDeployFieldIssue[] = [];

  if (!projectId) {
    issues.push(fieldIssue("projectId", "required", "Project ID is required."));
  }
  if (!accountId) {
    issues.push(fieldIssue("accountId", "required", "Cloudflare account ID is required."));
  }
  if (!apiToken) {
    issues.push(fieldIssue("apiToken", "required", "Cloudflare API token is required."));
  }
  if (!workerName) {
    issues.push(fieldIssue("workerName", "required", "Worker name is required."));
  } else if (!isValidWorkerName(workerName)) {
    issues.push(
      fieldIssue(
        "workerName",
        "invalid",
        "Worker name must use lowercase letters, numbers, and hyphens.",
      ),
    );
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      projectId: projectId as string,
      accountId: accountId as string,
      apiToken: apiToken as string,
      workerName,
    },
  };
}

export function generateCloudflareDeploySecret(): string {
  return randomBytes(32).toString("base64url");
}

export function redactCloudflareDeploySecrets(
  value: string,
  secrets: readonly (string | undefined)[],
): string {
  let redacted = value;
  for (const secret of secrets) {
    if (!secret || secret.length < 4) continue;
    redacted = redacted.replaceAll(secret, "[redacted]");
  }
  return redacted;
}

export function sanitizeCloudflareDeployError(
  error: unknown,
  secrets: readonly (string | undefined)[] = [],
): CloudflareDeploySanitizedError {
  if (error instanceof CloudflareDeployError) {
    return {
      code: error.code,
      message: redactCloudflareDeploySecrets(error.message, secrets),
      ...(error.status ? { status: error.status } : {}),
      retryable: error.retryable,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    code: "deploy.failed",
    message: redactCloudflareDeploySecrets(message, secrets),
    retryable: false,
  };
}
