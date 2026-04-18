import { applyGraphIdMap, type ResolvedGraphNamespace } from "@dpeek/graphle-kernel";
import { defineType } from "@dpeek/graphle-module";
import { dateTypeModule, stringTypeModule, urlTypeModule } from "@dpeek/graphle-module-core";

import deployIds from "./deploy.json";

export const cloudflareDeployMetadataRecordId = "graphle:deploy:cloudflare";
export const cloudflareDeployStatusValues = ["ready", "error"] as const;

export type CloudflareDeployPersistedStatus = (typeof cloudflareDeployStatusValues)[number];

export interface CloudflareDeployMetadata {
  readonly accountId: string;
  readonly workerName: string;
  readonly workerUrl: string;
  readonly durableObjectBinding: string;
  readonly durableObjectClass: string;
  readonly sourceCursor: string;
  readonly baselineHash: string;
  readonly deployedAt: string;
  readonly status: CloudflareDeployPersistedStatus;
  readonly errorSummary?: string;
}

export const cloudflareDeployTarget = defineType({
  values: { key: "deploy:cloudflareTarget", name: "Cloudflare Deploy Target" },
  fields: {
    accountId: stringTypeModule.field({
      cardinality: "one",
      meta: { label: "Cloudflare account ID" },
    }),
    workerName: stringTypeModule.field({
      cardinality: "one",
      meta: { label: "Worker name" },
    }),
    workerUrl: urlTypeModule.field({
      cardinality: "one",
      meta: { label: "Worker URL" },
    }),
    durableObjectBinding: stringTypeModule.field({
      cardinality: "one",
      meta: { label: "Durable Object binding" },
    }),
    durableObjectClass: stringTypeModule.field({
      cardinality: "one",
      meta: { label: "Durable Object class" },
    }),
    sourceCursor: stringTypeModule.field({
      cardinality: "one",
      meta: { label: "Source cursor" },
    }),
    baselineHash: stringTypeModule.field({
      cardinality: "one",
      meta: { label: "Baseline hash" },
    }),
    deployedAt: dateTypeModule.field({
      cardinality: "one",
      meta: { label: "Last deployed at" },
    }),
    status: stringTypeModule.field({
      cardinality: "one",
      meta: { label: "Status" },
    }),
    errorSummary: stringTypeModule.field({
      cardinality: "one?",
      meta: { label: "Error summary" },
    }),
  },
});

const cloudflareDeploySchemaInput = {
  cloudflareTarget: cloudflareDeployTarget,
};

export type CloudflareDeployNamespace = ResolvedGraphNamespace<typeof cloudflareDeploySchemaInput>;

export const cloudflareDeploy: CloudflareDeployNamespace = applyGraphIdMap(
  deployIds,
  cloudflareDeploySchemaInput,
);

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function stringField(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  if (value instanceof URL) return value.toString();
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function normalizeCloudflareDeployStatus(value: unknown): CloudflareDeployPersistedStatus {
  return value === "error" ? "error" : "ready";
}

export function parseCloudflareDeployMetadata(value: unknown): CloudflareDeployMetadata | null {
  if (!isObjectRecord(value)) return null;

  const accountId = stringField(value, "accountId");
  const workerName = stringField(value, "workerName");
  const workerUrl = stringField(value, "workerUrl");
  const durableObjectBinding = stringField(value, "durableObjectBinding");
  const durableObjectClass = stringField(value, "durableObjectClass");
  const sourceCursor = stringField(value, "sourceCursor");
  const baselineHash = stringField(value, "baselineHash");
  const deployedAt = stringField(value, "deployedAt");

  if (
    !accountId ||
    !workerName ||
    !workerUrl ||
    !durableObjectBinding ||
    !durableObjectClass ||
    !sourceCursor ||
    !baselineHash ||
    !deployedAt
  ) {
    return null;
  }

  return {
    accountId,
    workerName,
    workerUrl,
    durableObjectBinding,
    durableObjectClass,
    sourceCursor,
    baselineHash,
    deployedAt,
    status: normalizeCloudflareDeployStatus(value.status),
    ...(stringField(value, "errorSummary")
      ? { errorSummary: stringField(value, "errorSummary") }
      : {}),
  };
}
