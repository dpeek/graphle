import {
  defineInstalledModuleRecord,
  type InstalledModuleRecord,
  type InstalledModuleRuntimeExpectation,
} from "@io/graph-authority";
import { defineGraphModuleManifest, type GraphModuleManifest } from "@io/graph-module";
import { coreManifest } from "@io/graph-module-core";
import { workflowManifest } from "@io/graph-module-workflow";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createInstalledModuleGraphFromResolutions,
  createInstalledModuleContributionResolution,
  getBuiltInInstalledModuleContributionResolutions,
  type InstalledModuleGraph,
  type InstalledModuleContributionResolution,
} from "./installed-module-runtime.js";

const builtInManifestBySourceKey = new Map(
  [workflowManifest, coreManifest].map((manifest) => [
    createManifestSourceKey(manifest.source),
    manifest,
  ]),
);

export type InstalledModuleManifestLoadOptions = {
  readonly localSourceRoot?: string;
  readonly runtime?: InstalledModuleRuntimeExpectation | null;
};

function createManifestSourceKey(
  source: Pick<GraphModuleManifest["source"], "specifier" | "exportName">,
) {
  return `${source.specifier}#${source.exportName}`;
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolveBuiltInInstalledModuleManifest(
  record: Readonly<InstalledModuleRecord>,
): Readonly<GraphModuleManifest> {
  const manifest = builtInManifestBySourceKey.get(createManifestSourceKey(record.source));
  if (!manifest) {
    throw new TypeError(
      `Built-in installed module source "${record.source.specifier}" does not export "${record.source.exportName}".`,
    );
  }
  return manifest;
}

function resolveLocalInstalledModuleSourcePath(
  record: Readonly<InstalledModuleRecord>,
  rootDir: string,
): string {
  const { specifier } = record.source;
  const resolvedRootDir = resolve(rootDir);
  if (!specifier.startsWith("./")) {
    throw new TypeError(
      `Local installed module source "${specifier}" must use the supported "./" path under "${rootDir}".`,
    );
  }

  const resolvedPath = resolve(resolvedRootDir, specifier.slice(2));
  const relativePath = relative(resolvedRootDir, resolvedPath);
  if (relativePath === ".." || relativePath.startsWith("../")) {
    throw new TypeError(
      `Local installed module source "${specifier}" must stay within "${resolvedRootDir}".`,
    );
  }

  return resolvedPath;
}

async function importLocalInstalledModuleManifest(
  record: Readonly<InstalledModuleRecord>,
  rootDir: string,
): Promise<Readonly<GraphModuleManifest>> {
  const resolvedPath = resolveLocalInstalledModuleSourcePath(record, rootDir);

  let moduleExports: Record<string, unknown>;
  try {
    moduleExports = (await import(pathToFileURL(resolvedPath).href)) as Record<string, unknown>;
  } catch (error) {
    throw new TypeError(
      `Local installed module source "${record.source.specifier}" could not be loaded from "${resolvedPath}": ${asErrorMessage(error)}`,
    );
  }

  if (!(record.source.exportName in moduleExports)) {
    throw new TypeError(
      `Local installed module source "${record.source.specifier}" does not export "${record.source.exportName}".`,
    );
  }

  try {
    return defineGraphModuleManifest(
      moduleExports[record.source.exportName] as GraphModuleManifest,
    );
  } catch (error) {
    throw new TypeError(
      `Local installed module source "${record.source.specifier}" export "${record.source.exportName}" is invalid: ${asErrorMessage(error)}`,
    );
  }
}

export async function loadInstalledModuleManifest(
  record: InstalledModuleRecord,
  options?: Pick<InstalledModuleManifestLoadOptions, "localSourceRoot">,
): Promise<Readonly<GraphModuleManifest>> {
  const validatedRecord = defineInstalledModuleRecord(record);

  switch (validatedRecord.source.kind) {
    case "built-in":
      return resolveBuiltInInstalledModuleManifest(validatedRecord);
    case "local":
      return importLocalInstalledModuleManifest(
        validatedRecord,
        options?.localSourceRoot ?? process.cwd(),
      );
    default: {
      const exhaustive: never = validatedRecord.source.kind;
      return exhaustive;
    }
  }
}

export async function loadInstalledModuleContributionResolution(input: {
  readonly record: InstalledModuleRecord;
  readonly localSourceRoot?: string;
  readonly runtime?: InstalledModuleRuntimeExpectation | null;
}): Promise<InstalledModuleContributionResolution> {
  const record = defineInstalledModuleRecord(input.record);
  const manifest = await loadInstalledModuleManifest(record, {
    localSourceRoot: input.localSourceRoot,
  });

  return createInstalledModuleContributionResolution({
    manifest,
    record,
    runtime: input.runtime ?? null,
  });
}

export async function loadInstalledModuleContributionResolutions(input: {
  readonly records: readonly InstalledModuleRecord[];
  readonly localSourceRoot?: string;
  readonly runtime?: InstalledModuleRuntimeExpectation | null;
}): Promise<readonly InstalledModuleContributionResolution[]> {
  return Object.freeze(
    await Promise.all(
      input.records.map((record) =>
        loadInstalledModuleContributionResolution({
          record,
          localSourceRoot: input.localSourceRoot,
          runtime: input.runtime ?? null,
        }),
      ),
    ),
  );
}

export async function loadInstalledModuleGraph(input: {
  readonly records: readonly InstalledModuleRecord[];
  readonly localSourceRoot?: string;
  readonly runtime?: InstalledModuleRuntimeExpectation | null;
}): Promise<InstalledModuleGraph> {
  const resolutions = await loadInstalledModuleContributionResolutions(input);
  return createInstalledModuleGraphFromResolutions([
    ...getBuiltInInstalledModuleContributionResolutions(),
    ...resolutions,
  ]);
}
