import { describe, expect, it } from "bun:test";

import {
  probeContractItem,
  probeContractObjectView,
  probeContractWorkflow,
  probeSaveContractItemCommand,
} from "./graph/contracts.probe.js";

type GraphPackageJson = {
  exports: Record<string, string>;
};

describe("@io/core/graph adapter entry surfaces", () => {
  it("declares the reserved adapter subpath exports", async () => {
    const packageJson = (await Bun.file(
      new URL("../../package.json", import.meta.url),
    ).json()) as GraphPackageJson;

    expect(packageJson.exports).toMatchObject({
      "./graph": "./src/graph/index.ts",
      "./graph/react": "./src/graph/react/index.ts",
      "./graph/react-dom": "./src/graph/react-dom/index.ts",
      "./graph/react-opentui": "./src/graph/react-opentui/index.ts",
      "./graph/schema": "./src/graph/schema/index.ts",
      "./graph/schema/app/env-vars": "./src/graph/schema/app/env-vars/index.ts",
      "./graph/schema/app/outliner": "./src/graph/schema/app/outliner/index.ts",
      "./graph/schema/app/workspace": "./src/graph/schema/app/workspace/index.ts",
      "./graph/taxonomy/workspace": "./src/graph/taxonomy/workspace.ts",
    });
    expect(packageJson.exports["./graph/schema/*"]).toBeUndefined();
    expect(packageJson.exports["./graph/taxonomy/*"]).toBeUndefined();
  });

  it("exports the host-neutral React adapter while keeping host widgets on later subpaths", async () => {
    const [reactExports, reactDomExports, reactOpentuiExports] = await Promise.all([
      import("./react/index.js"),
      import("./react-dom/index.js"),
      import("./react-opentui/index.js"),
    ]);

    expect(Object.keys(reactExports).sort()).toEqual([
      "FilterOperandEditor",
      "GraphMutationRuntimeProvider",
      "PredicateFieldEditor",
      "PredicateFieldView",
      "clearOptionalReference",
      "compileWebFilterQuery",
      "countIssuesByStatus",
      "createWebFieldResolver",
      "createWebFilterResolver",
      "defaultWebFieldResolver",
      "defaultWebFilterResolver",
      "findIssueName",
      "formatPredicateEditorValue",
      "formatPredicateValue",
      "formatWorkspaceMutationError",
      "getPredicateCollectionKind",
      "getPredicateDisplayKind",
      "getPredicateEditorAutocomplete",
      "getPredicateEditorInputMode",
      "getPredicateEditorInputType",
      "getPredicateEditorKind",
      "getPredicateEditorParser",
      "getPredicateEditorPlaceholder",
      "getPredicateEntityReferenceOptions",
      "getPredicateEntityReferencePolicy",
      "getPredicateEntityReferenceSelection",
      "getPredicateEnumOptions",
      "getPredicateFieldMeta",
      "lowerWebFilterClause",
      "lowerWebFilterQuery",
      "performValidatedMutation",
      "persistSyncedGraphChanges",
      "setPredicateValue",
      "useOptionalMutationRuntime",
      "usePersistedMutationCallbacks",
      "usePredicateField",
      "usePredicateValue",
      "useWorkspaceManagementModel",
      "useWorkspaceSync",
      "validatePredicateValue",
    ]);
    expect(Object.keys(reactDomExports).sort()).toEqual([
      "FilterOperandEditor",
      "HostNeutralFilterOperandEditor",
      "PredicateFieldEditor",
      "PredicateFieldView",
      "WorkspaceManagementSurface",
      "compileWebFilterQuery",
      "createWebFieldResolver",
      "createWebFilterResolver",
      "defaultHostNeutralWebFilterResolver",
      "defaultWebFieldResolver",
      "defaultWebFilterResolver",
      "genericWebFieldEditorCapabilities",
      "genericWebFieldViewCapabilities",
      "genericWebFilterOperandEditorCapabilities",
      "lowerWebFilterClause",
      "lowerWebFilterQuery",
    ]);
    expect(Object.keys(reactOpentuiExports)).toEqual([]);
  });

  it("supports root-safe contract authoring from the package root without exposing host widgets", async () => {
    const rootExports = await import("./index.js");

    expect(rootExports).toMatchObject({
      core: expect.any(Object),
      createIdMap: expect.any(Function),
      defineNamespace: expect.any(Function),
      defineReferenceField: expect.any(Function),
      defineType: expect.any(Function),
      existingEntityReferenceField: expect.any(Function),
      existingEntityReferenceFieldMeta: expect.any(Function),
      stringTypeModule: expect.any(Object),
    });
    expect(Object.keys(rootExports)).not.toContain("FilterOperandEditor");
    expect(Object.keys(rootExports)).not.toContain("PredicateFieldView");

    expect(probeContractItem.kind).toBe("entity");
    expect(probeContractObjectView.entity).toBe(probeContractItem.values.key);
    expect(probeContractObjectView.commands).toEqual([probeSaveContractItemCommand.key]);
    expect(probeContractWorkflow.subjects).toEqual([probeContractItem.values.key]);
    expect(probeContractWorkflow.steps).toEqual([
      {
        key: "review",
        title: "Review details",
        objectView: probeContractObjectView.key,
      },
      {
        key: "save",
        title: "Save item",
        command: probeSaveContractItemCommand.key,
      },
    ]);
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
});
