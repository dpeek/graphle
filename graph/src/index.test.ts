import { describe, expect, it } from "bun:test";

type GraphPackageJson = {
  exports: Record<string, string>;
};

describe("@io/graph adapter entry surfaces", () => {
  it("declares the reserved adapter subpath exports", async () => {
    const packageJson = (await Bun.file(new URL("../package.json", import.meta.url)).json()) as GraphPackageJson;

    expect(packageJson.exports).toMatchObject({
      ".": "./src/index.ts",
      "./react": "./src/react/index.ts",
      "./react-dom": "./src/react-dom/index.ts",
      "./react-opentui": "./src/react-opentui/index.ts",
      "./schema": "./src/schema/index.ts",
    });
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
      "compileWebFilterQuery",
      "createWebFieldResolver",
      "createWebFilterResolver",
      "defaultWebFieldResolver",
      "defaultWebFilterResolver",
      "formatPredicateEditorValue",
      "formatPredicateValue",
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
      "useOptionalMutationRuntime",
      "usePersistedMutationCallbacks",
      "usePredicateField",
      "usePredicateValue",
    ]);
    expect(Object.keys(reactDomExports).sort()).toEqual([
      "FilterOperandEditor",
      "HostNeutralFilterOperandEditor",
      "PredicateFieldEditor",
      "PredicateFieldView",
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
});
