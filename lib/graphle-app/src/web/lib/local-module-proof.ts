import { defineGraphModuleManifest, defineType } from "@dpeek/graphle-module";
import { core } from "@dpeek/graphle-module-core";
import { applyGraphIdMap, type ResolvedGraphNamespace } from "@dpeek/graphle-kernel";
import {
  defineModuleQuerySurfaceCatalog,
  defineModuleQuerySurfaceSpec,
} from "@dpeek/graphle-projection";
import ids from "./local-module-proof.json";

export const localProofNode = defineType({
  values: {
    key: "probe:localProofNode",
    name: "Local Proof Node",
  },
  fields: {
    ...core.node.fields,
    proofNote: {
      ...core.node.fields.description,
      key: "probe:localProofNode:proofNote",
      meta: {
        ...core.node.fields.description.meta,
        label: "Proof note",
      },
    },
  },
});

type LocalProofNamespace = ResolvedGraphNamespace<{
  readonly localProofNode: typeof localProofNode;
}>;

export const localProofGraph: LocalProofNamespace = applyGraphIdMap(ids, {
  localProofNode,
});

export const localProofCatalogScopeQuerySurface = defineModuleQuerySurfaceSpec({
  surfaceId: "scope:probe.local-proof:catalog",
  surfaceVersion: "query-surface:probe.local-proof:catalog-scope:v1",
  label: "Local Proof Catalog Scope",
  description:
    "Local installed-module proof surface that demonstrates activation-driven query catalog composition without direct repo wiring.",
  queryKind: "scope",
  source: {
    kind: "scope",
    scopeId: "scope:probe.local-proof:catalog",
  },
  renderers: {
    compatibleRendererIds: ["default:list", "default:table"],
    itemEntityIds: "required",
    resultKind: "scope",
    sourceKinds: ["saved-query", "inline"],
  },
});

export const localProofQuerySurfaceCatalog = defineModuleQuerySurfaceCatalog({
  catalogId: "probe.local-proof:query-surfaces",
  catalogVersion: "query-catalog:probe.local-proof:v1",
  moduleId: "probe.local-proof",
  surfaces: [localProofCatalogScopeQuerySurface],
});

export const localModuleProofManifest = defineGraphModuleManifest({
  moduleId: "probe.local-proof",
  version: "0.0.1",
  source: {
    kind: "local",
    specifier: "./local-module-proof.ts",
    exportName: "localModuleProofManifest",
  },
  compatibility: {
    graph: "graph-schema:v1",
    runtime: "graph-runtime:v1",
  },
  runtime: {
    schemas: [
      {
        key: "probe.local-proof",
        namespace: localProofGraph,
      },
    ],
    querySurfaceCatalogs: [localProofQuerySurfaceCatalog],
  },
});
