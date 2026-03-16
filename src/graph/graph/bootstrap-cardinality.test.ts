import { describe, expect, it } from "bun:test";

import { bootstrap } from "./bootstrap";
import { core } from "./core";
import { edgeId, typeId } from "./schema";
import { createStore } from "./store";

describe("bootstrap cardinality metadata", () => {
  it("materializes predicate cardinality as enum value ids", () => {
    const store = createStore();
    bootstrap(store, core);

    const cardinalityPredicateId = edgeId(core.predicate.fields.cardinality);
    const keyPredicateNodeId = edgeId(core.predicate.fields.key);
    const value = store.facts(keyPredicateNodeId, cardinalityPredicateId)[0]?.o;

    expect(value).toBe(core.cardinality.values.one.id);
  });

  it("does not duplicate single-value schema facts across repeated bootstrap calls", () => {
    const store = createStore();
    bootstrap(store, core);
    bootstrap(store, core);

    const predicateId = edgeId(core.predicate.fields.key);
    const keyPredicateId = edgeId(core.predicate.fields.key);
    const namePredicateId = edgeId(core.node.fields.name);
    const rangePredicateId = edgeId(core.predicate.fields.range);
    const cardinalityPredicateId = edgeId(core.predicate.fields.cardinality);
    const nodeTypePredicateId = edgeId(core.node.fields.type);

    expect(store.facts(predicateId, keyPredicateId)).toHaveLength(1);
    expect(store.facts(predicateId, namePredicateId)).toHaveLength(1);
    expect(store.facts(predicateId, rangePredicateId)).toHaveLength(1);
    expect(store.facts(predicateId, cardinalityPredicateId)).toHaveLength(1);
    expect(store.facts(predicateId, nodeTypePredicateId)).toHaveLength(1);
    expect(store.facts(typeId(core.predicate), keyPredicateId)).toHaveLength(1);
    expect(store.facts(typeId(core.predicate), namePredicateId)).toHaveLength(1);
  });
});
