import { describe, expect, it } from "bun:test";

import {
  probeContractItem,
  probeContractObjectView,
  probeContractWorkflow,
  probeSaveContractItemCommand,
} from "./runtime/contracts.probe.js";

type GraphPackageJson = {
  exports: Record<string, string>;
};

const publicGraphSubpaths = [
  "./graph",
  "./graph/runtime",
  "./graph/authority",
  "./graph/def",
  "./graph/modules",
  "./graph/modules/core",
  "./graph/modules/ops",
  "./graph/modules/ops/env-var",
  "./graph/modules/pkm",
  "./graph/modules/pkm/topic",
  "./graph/react",
  "./graph/react-dom",
  "./graph/react-opentui",
  "./graph/adapters/react",
  "./graph/adapters/react-dom",
  "./graph/adapters/react-opentui",
  "./graph/schema",
  "./graph/schema/core",
  "./graph/schema/ops",
  "./graph/schema/ops/env-var",
  "./graph/schema/pkm",
  "./graph/schema/pkm/topic",
  "./graph/schema/test",
] as const;

const retiredGraphSubpaths = [
  "./graph/modules/*",
  "./graph/adapters/*",
  "./graph/modules/app",
  "./graph/modules/app/topic",
  "./graph/schema/app",
  "./graph/schema/app/topic",
  "./graph/schema/*",
  "./graph/taxonomy/*",
] as const;

const requiredRootExports = [
  "core",
  "ops",
  "pkm",
  "createIdMap",
  "defineNamespace",
  "defineReferenceField",
  "defineType",
  "existingEntityReferenceField",
  "existingEntityReferenceFieldMeta",
  "stringTypeModule",
] as const;

const requiredReactExports = [
  "createWebFieldResolver",
  "defaultWebFieldResolver",
  "performValidatedMutation",
  "usePredicateField",
] as const;

const requiredReactDomExports = [
  "FilterOperandEditor",
  "GraphIcon",
  "PredicateFieldEditor",
  "PredicateFieldView",
  "defaultWebFilterResolver",
] as const;

function expectNamedExports(
  moduleExports: Record<string, unknown>,
  names: readonly string[],
): void {
  expect(Object.keys(moduleExports)).toEqual(expect.arrayContaining([...names]));
}

describe("@io/core/graph package entry surfaces", () => {
  it("declares the stable graph subpaths without reviving retired aliases", async () => {
    const packageJson = (await Bun.file(
      new URL("../../package.json", import.meta.url),
    ).json()) as GraphPackageJson;

    for (const subpath of publicGraphSubpaths) {
      expect(packageJson.exports[subpath]).toEqual(expect.any(String));
    }

    for (const subpath of retiredGraphSubpaths) {
      expect(packageJson.exports[subpath]).toBeUndefined();
    }
  });

  it("keeps adapter shims aligned with the canonical adapter surfaces", async () => {
    const [
      reactExports,
      reactAdapterExports,
      reactDomExports,
      reactDomAdapterExports,
      reactOpentuiExports,
      reactOpentuiAdapterExports,
    ] = await Promise.all([
      import("@io/core/graph/react"),
      import("@io/core/graph/adapters/react"),
      import("@io/core/graph/react-dom"),
      import("@io/core/graph/adapters/react-dom"),
      import("@io/core/graph/react-opentui"),
      import("@io/core/graph/adapters/react-opentui"),
    ]);

    expectNamedExports(reactExports, requiredReactExports);
    expect(Object.keys(reactAdapterExports).sort()).toEqual(Object.keys(reactExports).sort());
    expect(reactAdapterExports.createWebFieldResolver).toBe(reactExports.createWebFieldResolver);
    expect(reactAdapterExports.usePredicateField).toBe(reactExports.usePredicateField);

    expectNamedExports(reactDomExports, requiredReactDomExports);
    expect(Object.keys(reactDomAdapterExports).sort()).toEqual(Object.keys(reactDomExports).sort());
    expect(reactDomAdapterExports.GraphIcon).toBe(reactDomExports.GraphIcon);
    expect(reactDomAdapterExports.PredicateFieldEditor).toBe(reactDomExports.PredicateFieldEditor);
    expect(Object.keys(reactOpentuiExports)).toEqual([]);
    expect(Object.keys(reactOpentuiAdapterExports)).toEqual([]);
  });

  it("supports root-safe contract authoring from the package root without exposing host widgets", async () => {
    const rootExports = await import("@io/core/graph");

    expectNamedExports(rootExports, requiredRootExports);
    expect(Object.keys(rootExports)).not.toContain("FilterOperandEditor");
    expect(Object.keys(rootExports)).not.toContain("PredicateFieldView");

    expect(probeContractItem.kind).toBe("entity");
    expect(probeContractObjectView).toMatchObject({
      entity: probeContractItem.values.key,
      commands: [probeSaveContractItemCommand.key],
    });
    expect(probeContractWorkflow).toMatchObject({
      subjects: [probeContractItem.values.key],
      commands: [probeSaveContractItemCommand.key],
    });
    expect(probeContractWorkflow.steps).toHaveLength(2);
    expect(probeContractWorkflow.steps[0]).toMatchObject({
      objectView: probeContractObjectView.key,
    });
    expect(probeContractWorkflow.steps[1]).toMatchObject({
      command: probeSaveContractItemCommand.key,
    });
    expect(probeSaveContractItemCommand).toMatchObject({
      subject: probeContractItem.values.key,
      execution: "optimisticVerify",
      policy: {
        capabilities: ["probe.contract.write"],
        touchesPredicates: [
          probeContractItem.fields.name.key,
          probeContractItem.fields.summary.key,
        ],
      },
    });
  });

  it("keeps module and schema root surfaces aligned with the canonical namespace exports", async () => {
    const [moduleExports, schemaExports, coreExports, opsExports, pkmExports, testSchemaExports] =
      await Promise.all([
        import("@io/core/graph/modules"),
        import("@io/core/graph/schema"),
        import("@io/core/graph/modules/core"),
        import("@io/core/graph/modules/ops"),
        import("@io/core/graph/modules/pkm"),
        import("@io/core/graph/schema/test"),
      ]);

    expect(moduleExports.core).toBe(coreExports.core);
    expect(moduleExports.ops).toBe(opsExports.ops);
    expect(moduleExports.pkm).toBe(pkmExports.pkm);
    expect(schemaExports.core).toBe(coreExports.core);
    expect(schemaExports.ops).toBe(opsExports.ops);
    expect(schemaExports.pkm).toBe(pkmExports.pkm);
    expect(typeof schemaExports.ops.envVar.values.id).toBe("string");
    expect(typeof schemaExports.pkm.topic.values.id).toBe("string");
    expect(testSchemaExports.kitchenSink.record.values.key).toBe(
      testSchemaExports.kitchenSinkRecord.values.key,
    );
  });
});
