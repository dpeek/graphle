import { describe, expect, it } from "bun:test";

import { defineInstalledModuleRecord, type InstalledModuleRecord } from "@io/graph-authority";
import { coreManifest } from "@io/graph-module-core";
import { fileURLToPath } from "node:url";

import {
  loadInstalledModuleContributionResolution,
  loadInstalledModuleContributionResolutions,
  loadInstalledModuleGraph,
} from "./installed-module-manifest-loader.js";
import {
  createBuiltInInstalledModuleRecord,
  createInstalledModuleGraphFromResolutions,
} from "./installed-module-runtime.js";
import { localModuleProofManifest } from "./local-module-proof.js";

const localSourceRoot = fileURLToPath(new URL(".", import.meta.url));
const changedAt = "2026-04-02T00:00:00.000Z";
const installedAt = "2026-04-02T00:00:00.000Z";
const updatedAt = "2026-04-02T00:00:00.000Z";

const localRuntimeExpectation = {
  graph: localModuleProofManifest.compatibility.graph,
  runtime: localModuleProofManifest.compatibility.runtime,
  supportedSourceKinds: ["built-in", "local"] as const,
};

function createLocalInstalledRecord(
  overrides?: Partial<InstalledModuleRecord> & {
    readonly source?: Partial<InstalledModuleRecord["source"]>;
  },
): Readonly<InstalledModuleRecord> {
  const activation = overrides?.activation;
  const source = overrides?.source;

  return defineInstalledModuleRecord({
    moduleId: overrides?.moduleId ?? localModuleProofManifest.moduleId,
    version: overrides?.version ?? localModuleProofManifest.version,
    bundleDigest:
      overrides?.bundleDigest ??
      `sha256:${localModuleProofManifest.moduleId}:${localModuleProofManifest.version}`,
    source: {
      kind: source?.kind ?? localModuleProofManifest.source.kind,
      specifier: source?.specifier ?? localModuleProofManifest.source.specifier,
      exportName: source?.exportName ?? localModuleProofManifest.source.exportName,
    },
    compatibility: {
      graph: overrides?.compatibility?.graph ?? localModuleProofManifest.compatibility.graph,
      runtime: overrides?.compatibility?.runtime ?? localModuleProofManifest.compatibility.runtime,
    },
    installState: overrides?.installState ?? "installed",
    activation: {
      desired: "active",
      status: "active",
      changedAt,
      ...activation,
    },
    grantedPermissionKeys: overrides?.grantedPermissionKeys ?? [],
    installedAt: overrides?.installedAt ?? installedAt,
    updatedAt: overrides?.updatedAt ?? updatedAt,
    ...(overrides?.lastSuccessfulMigrationVersion
      ? { lastSuccessfulMigrationVersion: overrides.lastSuccessfulMigrationVersion }
      : {}),
  });
}

describe("installed module manifest loader", () => {
  it("loads built-in and local manifests through the activation-backed resolution path", async () => {
    const resolutions = await loadInstalledModuleContributionResolutions({
      records: [createBuiltInInstalledModuleRecord(coreManifest), createLocalInstalledRecord()],
      localSourceRoot,
      runtime: localRuntimeExpectation,
    });

    expect(resolutions.map((resolution) => resolution.manifest.moduleId)).toEqual([
      "core",
      "probe.local-proof",
    ]);
    expect(resolutions.map((resolution) => resolution.record.source.kind)).toEqual([
      "built-in",
      "local",
    ]);

    const graph = createInstalledModuleGraphFromResolutions(resolutions);
    expect(graph).toHaveProperty("node");
    expect(graph).toHaveProperty("localProofNode");
  });

  it("fails clearly when the local source file is missing", async () => {
    await expect(
      loadInstalledModuleContributionResolution({
        record: createLocalInstalledRecord({
          source: {
            specifier: "./missing-local-module-proof.ts",
          },
        }),
        localSourceRoot,
        runtime: localRuntimeExpectation,
      }),
    ).rejects.toThrow(
      'Local installed module source "./missing-local-module-proof.ts" could not be loaded',
    );
  });

  it("fails clearly when the local manifest export is invalid", async () => {
    await expect(
      loadInstalledModuleContributionResolution({
        record: createLocalInstalledRecord({
          source: {
            specifier: "./local-module-proof.invalid.ts",
            exportName: "invalidLocalModuleProofManifest",
          },
        }),
        localSourceRoot,
        runtime: localRuntimeExpectation,
      }),
    ).rejects.toThrow(
      'Local installed module source "./local-module-proof.invalid.ts" export "invalidLocalModuleProofManifest" is invalid: runtime must declare at least one contribution.',
    );
  });

  it("fails closed when the runtime does not accept local sources", async () => {
    await expect(
      loadInstalledModuleContributionResolution({
        record: createLocalInstalledRecord(),
        localSourceRoot,
        runtime: {
          ...localRuntimeExpectation,
          supportedSourceKinds: ["built-in"],
        },
      }),
    ).rejects.toThrow(
      'Module target "probe.local-proof@0.0.1" uses source kind "local" but the runtime only accepts built-in.',
    );
  });

  it("composes built-ins with only the active local installed-module graph", async () => {
    const activeGraph = await loadInstalledModuleGraph({
      records: [createLocalInstalledRecord()],
      localSourceRoot,
      runtime: localRuntimeExpectation,
    });
    const inactiveGraph = await loadInstalledModuleGraph({
      records: [
        createLocalInstalledRecord({
          activation: {
            desired: "inactive",
            status: "inactive",
            changedAt,
          },
        }),
      ],
      localSourceRoot,
      runtime: localRuntimeExpectation,
    });

    expect(activeGraph).toHaveProperty("node");
    expect(activeGraph).toHaveProperty("project");
    expect(activeGraph).toHaveProperty("localProofNode");
    expect(inactiveGraph).toHaveProperty("node");
    expect(inactiveGraph).toHaveProperty("project");
    expect(inactiveGraph).not.toHaveProperty("localProofNode");
  });
});
