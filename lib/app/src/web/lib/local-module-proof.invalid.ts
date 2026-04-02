export const invalidLocalModuleProofManifest = {
  moduleId: "probe.local-proof",
  version: "0.0.1",
  source: {
    kind: "local",
    specifier: "./local-module-proof.invalid.ts",
    exportName: "invalidLocalModuleProofManifest",
  },
  compatibility: {
    graph: "graph-schema:v1",
    runtime: "graph-runtime:v1",
  },
  runtime: {},
} as const;
