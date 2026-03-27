import { describe, expect, it } from "bun:test";

const requiredExports = [
  "FilterOperandEditor",
  "PredicateFieldEditor",
  "PredicateFieldView",
  "SvgMarkup",
  "SvgPreview",
  "createWebFieldResolver",
  "createWebFilterResolver",
  "defaultWebFieldResolver",
  "defaultWebFilterResolver",
  "genericWebFieldEditorCapabilities",
  "genericWebFieldViewCapabilities",
  "genericWebFilterOperandEditorCapabilities",
] as const;

const forbiddenExports = [
  "GraphMutationRuntimeProvider",
  "GraphRuntimeProvider",
  "useGraphQuery",
  "useGraphRuntime",
  "usePredicateField",
  "createGraphFieldResolver",
  "createGraphFilterResolver",
  "GraphIcon",
] as const;

describe("@io/graph-react-dom", () => {
  it("keeps the package surface focused on browser adapter behavior", async () => {
    const adapterExports = await import("@io/graph-react-dom");

    expect(Object.keys(adapterExports)).toEqual(expect.arrayContaining([...requiredExports]));
    for (const name of forbiddenExports) {
      expect(Object.keys(adapterExports)).not.toContain(name);
    }
  });
});
