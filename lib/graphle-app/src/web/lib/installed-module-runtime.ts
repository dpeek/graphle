import {
  defineInstalledModuleRecord,
  defineInstalledModuleTarget,
  validateInstalledModuleCompatibility,
  type InstalledModuleRecord,
  type InstalledModuleRuntimeExpectation,
} from "@dpeek/graphle-authority";
import {
  defineGraphModuleManifest,
  type GraphModuleManifest,
  type GraphModuleSchemaContribution,
} from "@dpeek/graphle-module";
import { core, coreManifest } from "@dpeek/graphle-module-core";
import { workflow, workflowManifest } from "@dpeek/graphle-module-workflow";
import type { AnyTypeOutput } from "@dpeek/graphle-kernel";

export type InstalledModuleContributionResolution = {
  readonly manifest: GraphModuleManifest;
  readonly record: InstalledModuleRecord;
};

export type InstalledModuleGraph = Readonly<Record<string, AnyTypeOutput>>;
export type BuiltInInstalledModuleGraph = typeof core & typeof workflow;

const builtInInstalledModuleChangedAt = "2026-04-02T00:00:00.000Z";
const builtInInstalledModuleManifests = [workflowManifest, coreManifest] as const;

type InstalledModuleSchemaContribution = GraphModuleSchemaContribution<
  Record<string, AnyTypeOutput>
>;

export function createBuiltInInstalledModuleRecord(
  manifest: GraphModuleManifest,
): Readonly<InstalledModuleRecord> {
  return defineInstalledModuleRecord({
    moduleId: manifest.moduleId,
    version: manifest.version,
    bundleDigest: `built-in:${manifest.source.specifier}:${manifest.version}`,
    source: manifest.source,
    compatibility: manifest.compatibility,
    installState: "installed",
    activation: {
      desired: "active",
      status: "active",
      changedAt: builtInInstalledModuleChangedAt,
    },
    grantedPermissionKeys: [],
    installedAt: builtInInstalledModuleChangedAt,
    updatedAt: builtInInstalledModuleChangedAt,
  });
}

function isActiveInstalledModuleRecord(record: InstalledModuleRecord): boolean {
  return record.installState === "installed" && record.activation.status === "active";
}

function isInactiveInstalledModuleRecord(record: InstalledModuleRecord): boolean {
  return record.installState === "installed" && record.activation.status === "inactive";
}

function describeModuleRuntimeState(record: InstalledModuleRecord): string {
  return `${record.installState}/${record.activation.status}`;
}

export function createInstalledModuleContributionResolution(input: {
  readonly manifest: GraphModuleManifest;
  readonly record: InstalledModuleRecord;
  readonly runtime?: InstalledModuleRuntimeExpectation | null;
}): InstalledModuleContributionResolution {
  const manifest = defineGraphModuleManifest(input.manifest);
  const record = defineInstalledModuleRecord(input.record);
  const compatibility = validateInstalledModuleCompatibility({
    target: defineInstalledModuleTarget({
      moduleId: manifest.moduleId,
      version: manifest.version,
      bundleDigest: record.bundleDigest,
      source: manifest.source,
      compatibility: manifest.compatibility,
    }),
    record,
    runtime: input.runtime ?? null,
  });

  if (!compatibility.ok || compatibility.status !== "matches-record") {
    throw new TypeError(
      compatibility.ok
        ? `Installed module "${record.moduleId}" does not match the current manifest identity or compatibility.`
        : compatibility.message,
    );
  }

  return Object.freeze({
    manifest,
    record,
  });
}

export function resolveActiveInstalledModuleContributionResolutions(
  resolutions: readonly InstalledModuleContributionResolution[],
): readonly InstalledModuleContributionResolution[] {
  const activeResolutions: InstalledModuleContributionResolution[] = [];

  for (const resolution of resolutions) {
    const { manifest, record } = createInstalledModuleContributionResolution(resolution);

    if (isInactiveInstalledModuleRecord(record)) {
      continue;
    }

    if (!isActiveInstalledModuleRecord(record)) {
      throw new TypeError(
        `Installed module "${record.moduleId}" is unavailable while the module is ${describeModuleRuntimeState(record)}.`,
      );
    }

    activeResolutions.push({
      manifest,
      record,
    });
  }

  return Object.freeze(activeResolutions);
}

export function getBuiltInInstalledModuleContributionResolutions(): readonly InstalledModuleContributionResolution[] {
  return Object.freeze(
    builtInInstalledModuleManifests.map((manifest) =>
      createInstalledModuleContributionResolution({
        manifest,
        record: createBuiltInInstalledModuleRecord(manifest),
      }),
    ),
  );
}

export function resolveInstalledModuleSchemaContributions(
  resolutions: readonly InstalledModuleContributionResolution[],
): readonly InstalledModuleSchemaContribution[] {
  const contributions: InstalledModuleSchemaContribution[] = [];
  const seenContributionKeys = new Set<string>();

  for (const { manifest, record } of resolveActiveInstalledModuleContributionResolutions(
    resolutions,
  )) {
    const moduleContributions = manifest.runtime.schemas as
      | readonly InstalledModuleSchemaContribution[]
      | undefined;

    if (!moduleContributions || moduleContributions.length === 0) {
      throw new TypeError(
        `Active installed module "${record.moduleId}" does not publish any schemas.`,
      );
    }

    for (const contribution of moduleContributions) {
      if (seenContributionKeys.has(contribution.key)) {
        throw new TypeError(
          `Activation-driven schema composition must not duplicate schema contribution "${contribution.key}".`,
        );
      }
      seenContributionKeys.add(contribution.key);
      contributions.push(contribution);
    }
  }

  if (contributions.length === 0) {
    throw new TypeError(
      "Activation-driven graph composition produced no active installed schemas.",
    );
  }

  return Object.freeze([...contributions]);
}

export function createInstalledModuleGraph(
  contributions: readonly InstalledModuleSchemaContribution[],
): InstalledModuleGraph {
  const graph: Record<string, AnyTypeOutput> = {};

  for (const contribution of contributions) {
    for (const [definitionKey, definition] of Object.entries(contribution.namespace)) {
      if (definitionKey in graph) {
        throw new TypeError(
          `Activation-driven graph composition must not duplicate definition "${definitionKey}".`,
        );
      }
      graph[definitionKey] = definition;
    }
  }

  if (Object.keys(graph).length === 0) {
    throw new TypeError(
      "Activation-driven graph composition must include at least one definition.",
    );
  }

  return Object.freeze(graph);
}

export function createInstalledModuleGraphFromResolutions(
  resolutions: readonly InstalledModuleContributionResolution[],
): InstalledModuleGraph {
  return createInstalledModuleGraph(resolveInstalledModuleSchemaContributions(resolutions));
}

let builtInInstalledModuleGraphCache: BuiltInInstalledModuleGraph | undefined;

export function getBuiltInInstalledModuleGraph(): BuiltInInstalledModuleGraph {
  builtInInstalledModuleGraphCache ??= createInstalledModuleGraphFromResolutions(
    getBuiltInInstalledModuleContributionResolutions(),
  ) as BuiltInInstalledModuleGraph;
  return builtInInstalledModuleGraphCache;
}

export const builtInInstalledModuleGraph = getBuiltInInstalledModuleGraph();
