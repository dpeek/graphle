import { describe, expect, it } from "bun:test";

import { bootstrap, createStore, createTypeClient, core, isEntityType } from "@io/core/graph";
import { ops } from "@io/core/graph/schema/ops";
import { pkm } from "@io/core/graph/schema/pkm";

import { seedExampleGraph } from "../../lib/example-data.js";
import { buildEntityCatalog, buildTypeCatalog } from "./catalog.js";
import { explorerNamespace } from "./model.js";

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
  it("builds the type catalog from the full explorer namespace", () => {
    const { store } = createCatalogFixture();
    const entries = buildTypeCatalog(store);
    const byKey = new Map(entries.map((entry) => [entry.key, entry]));

    expect([...byKey.keys()].sort()).toEqual(
      Object.values(explorerNamespace)
        .map((typeDef) => typeDef.values.key)
        .sort(),
    );
    expect(byKey.get("pkm:topic")?.dataCount).toBe(3);
    expect(byKey.get("core:tag")?.dataCount).toBe(2);
    expect(byKey.get("pkm:topicKind")?.kind).toBe("enum");
    expect(byKey.get("core:string")?.kind).toBe("scalar");
  });

  it("builds entity lists for every explorer entity type", () => {
    const { graph, store } = createCatalogFixture();
    const entries = buildEntityCatalog(graph, store);
    const byKey = new Map(entries.map((entry) => [entry.key, entry]));

    expect([...byKey.keys()].sort()).toEqual(
      Object.values(explorerNamespace)
        .filter((typeDef) => isEntityType(typeDef))
        .map((typeDef) => typeDef.values.key)
        .sort(),
    );
    expect(byKey.get("pkm:topic")?.count).toBe(3);
    expect(byKey.get("ops:envVar")?.count).toBe(0);
    expect(byKey.get("core:icon")?.count).toBeGreaterThan(0);
    expect(byKey.get("core:tag")?.count).toBe(2);
    expect(byKey.get("core:type")?.count).toBeGreaterThan(0);
    expect(byKey.get("core:predicate")?.count).toBeGreaterThan(0);
    expect(byKey.get("core:secretHandle")?.count).toBe(0);

    const coreTypeEntry = byKey.get("core:type");
    const coreTypeId = coreTypeEntry?.ids[0];
    if (!coreTypeEntry || !coreTypeId) {
      throw new Error('Expected the catalog to expose at least one "core:type" entity.');
    }
    expect(coreTypeEntry.getRef(coreTypeId).id).toBe(coreTypeId);
  });
});
