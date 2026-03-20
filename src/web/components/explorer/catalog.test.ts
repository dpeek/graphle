import { describe, expect, it } from "bun:test";

import { bootstrap, createStore, createTypeClient, core, isEntityType } from "@io/core/graph";
import { ops } from "@io/core/graph/schema/ops";
import { pkm } from "@io/core/graph/schema/pkm";

import { seedExampleGraph } from "../../lib/example-data.js";
import { buildEntityCatalog, buildTypeCatalog } from "./catalog.js";
import { explorerNamespace } from "./model.js";

function byKey<T extends { key: string }>(entries: readonly T[]) {
  return new Map(entries.map((entry) => [entry.key, entry]));
}

function createCatalogFixture() {
  const store = createStore();
  bootstrap(store, core);
  bootstrap(store, pkm);
  bootstrap(store, ops);

  const graph = createTypeClient(store, { ...core, ...pkm, ...ops });
  seedExampleGraph(graph);

  return { graph, store };
}

describe("explorer catalog", () => {
  it("builds explorer type entries with representative counts and definitions", () => {
    const { store } = createCatalogFixture();
    const entries = buildTypeCatalog(store);
    const catalog = byKey(entries);

    expect(entries).toHaveLength(Object.values(explorerNamespace).length);
    expect(catalog.get("pkm:topic")).toMatchObject({
      key: "pkm:topic",
      kind: "entity",
      dataCount: 3,
    });
    expect(catalog.get("pkm:topic")?.fieldDefs.map((field) => field.pathLabel)).toEqual(
      expect.arrayContaining(["content", "kind", "references"]),
    );
    expect(catalog.get("core:tag")).toMatchObject({
      key: "core:tag",
      kind: "entity",
      dataCount: 2,
    });
    expect(catalog.get("pkm:topicKind")).toMatchObject({
      key: "pkm:topicKind",
      kind: "enum",
      dataCount: 0,
    });
    expect(catalog.get("pkm:topicKind")?.optionDefs.length).toBeGreaterThan(0);
    expect(catalog.get("core:string")).toMatchObject({
      key: "core:string",
      kind: "scalar",
      dataCount: 0,
    });
  });

  it("builds entity entries with handles for every explorer entity type", () => {
    const { graph, store } = createCatalogFixture();
    const entries = buildEntityCatalog(graph, store);
    const catalog = byKey(entries);

    expect(entries).toHaveLength(Object.values(explorerNamespace).filter(isEntityType).length);
    expect(entries.every((entry) => entry.typeDef.kind === "entity")).toBe(true);
    expect(catalog.get("pkm:topic")).toMatchObject({
      key: "pkm:topic",
      count: 3,
    });
    expect(typeof catalog.get("pkm:topic")?.create).toBe("function");
    expect(typeof catalog.get("pkm:topic")?.validateCreate).toBe("function");
    expect(catalog.get("ops:envVar")?.count).toBe(0);
    expect(catalog.get("core:icon")?.count).toBeGreaterThan(0);
    expect(catalog.get("core:tag")?.count).toBe(2);
    expect(catalog.get("core:type")?.count).toBeGreaterThan(0);
    expect(catalog.get("core:predicate")?.count).toBeGreaterThan(0);
    expect(catalog.get("core:secretHandle")?.count).toBe(0);

    const coreTypeEntry = catalog.get("core:type");
    const coreTypeId = coreTypeEntry?.ids[0];
    if (!coreTypeEntry || !coreTypeId) {
      throw new Error('Expected the catalog to expose at least one "core:type" entity.');
    }
    expect(coreTypeEntry.getRef(coreTypeId).id).toBe(coreTypeId);
  });
});
