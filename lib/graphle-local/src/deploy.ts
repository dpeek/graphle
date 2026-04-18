import { readFile } from "node:fs/promises";

import {
  cloudflareAccountIdEnvKey,
  cloudflareApiTokenEnvKey,
  graphleCloudflareWorkerNameEnvKey,
  parseCloudflareDeployMetadata,
  validateCloudflareDeployInput,
  type CloudflareDeployInput,
  type CloudflareDeployMetadata,
  type CloudflareDeploySanitizedError,
  type CloudflareDeployStatus,
} from "@dpeek/graphle-deploy-cloudflare";
import type { PublicSiteGraphBaseline } from "@dpeek/graphle-module-site";

import type { GraphleLocalProject } from "./project.js";
import type { LocalSiteAuthority } from "./site-authority.js";

export interface LocalCloudflareDeployCredentials {
  readonly accountId?: string;
  readonly apiToken?: string;
  readonly workerName?: string;
}

export interface LocalDeployStatusOptions {
  readonly authority: LocalSiteAuthority | undefined;
  readonly baseline: PublicSiteGraphBaseline;
  readonly credentials: LocalCloudflareDeployCredentials;
  readonly stateOverride?: "deploying";
  readonly error?: CloudflareDeploySanitizedError;
}

function unwrapEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvValue(content: string, key: string): string | undefined {
  for (const line of content.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || match[1] !== key) continue;
    const value = unwrapEnvValue(match[2] ?? "");
    return value.trim().length > 0 ? value : undefined;
  }
  return undefined;
}

export async function readLocalCloudflareDeployCredentials(
  project: GraphleLocalProject,
): Promise<LocalCloudflareDeployCredentials> {
  let content = "";
  try {
    content = await readFile(project.env.path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code !== "ENOENT") throw error;
  }

  return {
    accountId: parseEnvValue(content, cloudflareAccountIdEnvKey),
    apiToken: parseEnvValue(content, cloudflareApiTokenEnvKey),
    workerName: parseEnvValue(content, graphleCloudflareWorkerNameEnvKey),
  };
}

export function readLocalCloudflareDeployMetadata(
  authority: LocalSiteAuthority | undefined,
): CloudflareDeployMetadata | null {
  const records = authority?.graph.cloudflareTarget.list() ?? [];
  return parseCloudflareDeployMetadata(records[0] ?? null);
}

export async function persistLocalCloudflareDeployMetadata(
  authority: LocalSiteAuthority,
  metadata: CloudflareDeployMetadata,
): Promise<void> {
  const existing = authority.graph.cloudflareTarget.list()[0];
  const input = {
    accountId: metadata.accountId,
    workerName: metadata.workerName,
    workerUrl: new URL(metadata.workerUrl),
    durableObjectBinding: metadata.durableObjectBinding,
    durableObjectClass: metadata.durableObjectClass,
    sourceCursor: metadata.sourceCursor,
    baselineHash: metadata.baselineHash,
    deployedAt: new Date(metadata.deployedAt),
    status: metadata.status,
    ...(metadata.errorSummary ? { errorSummary: metadata.errorSummary } : {}),
  };

  if (existing) {
    authority.graph.cloudflareTarget.update(existing.id, input);
  } else {
    authority.graph.cloudflareTarget.create(input);
  }
  await authority.persist();
}

function missingCredentialNames(input: CloudflareDeployInput): readonly string[] {
  const validation = validateCloudflareDeployInput(input);
  return validation.ok ? [] : validation.issues.map((issue) => issue.field);
}

export function buildLocalCloudflareDeployStatus({
  authority,
  baseline,
  credentials,
  stateOverride,
  error,
}: LocalDeployStatusOptions): CloudflareDeployStatus {
  const metadata = readLocalCloudflareDeployMetadata(authority);
  const accountId = credentials.accountId ?? metadata?.accountId;
  const workerName = credentials.workerName ?? metadata?.workerName;
  const missing = missingCredentialNames({
    projectId: "status",
    accountId,
    apiToken: credentials.apiToken,
    workerName,
  }).filter((field) => field !== "projectId");
  const matchesLastDeploy = metadata?.baselineHash === baseline.baselineHash;

  return {
    state: stateOverride ?? (error ? "error" : metadata ? metadata.status : "idle"),
    credentials: {
      ...(accountId ? { accountId } : {}),
      ...(workerName ? { workerName } : {}),
      hasApiToken: Boolean(credentials.apiToken),
      missing,
    },
    metadata,
    currentBaseline: {
      sourceCursor: baseline.sourceCursor,
      baselineHash: baseline.baselineHash,
      generatedAt: baseline.generatedAt,
      matchesLastDeploy,
    },
    ...(error ? { error } : {}),
  };
}

export function mergeLocalCloudflareDeployInput({
  body,
  credentials,
  metadata,
  projectId,
}: {
  readonly body: Partial<CloudflareDeployInput>;
  readonly credentials: LocalCloudflareDeployCredentials;
  readonly metadata: CloudflareDeployMetadata | null;
  readonly projectId: string;
}): CloudflareDeployInput {
  return {
    projectId,
    accountId: body.accountId ?? credentials.accountId ?? metadata?.accountId,
    apiToken: body.apiToken ?? credentials.apiToken,
    workerName: body.workerName ?? credentials.workerName ?? metadata?.workerName,
  };
}
