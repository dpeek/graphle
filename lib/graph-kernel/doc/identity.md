---
name: Graph kernel identity
description: "Opaque id generation, schema-owned key extraction, and stable id reconciliation in @io/graph-kernel."
last_updated: 2026-04-02
---

# Graph kernel identity

## Read this when

- you are changing `createGraphId()`, `createGraphIdMap()`, or `applyGraphIdMap()`
- you need to understand authored keys versus resolved stable ids
- you are changing schema evolution behavior such as orphan pruning or missing-id handling

## Main source anchors

- `../src/id.ts`: opaque runtime id generation
- `../src/identity.ts`: stable id map extraction, reconciliation, and application
- `../src/id.test.ts`: UUIDv7 and monotonicity expectations
- `../src/identity.test.ts`: reconciliation, pruning, duplicate-id rejection, and in-place application

## Two identity layers

- Runtime-created node and edge ids come from `createGraphId()`.
- Schema-owned ids come from `createGraphIdMap()`, which assigns opaque ids to authored schema keys.

Both are opaque strings. The current generator emits UUIDv7 values backed by Web Crypto and preserves monotonic ordering within one process, but callers must not depend on the textual shape beyond ordinary string storage and comparison.

## Schema-owned keys

`extractGraphSchemaKeys()` collects the durable keys that the namespace owns:

- type keys
- nested field-tree keys
- predicate keys
- enum option keys

It filters the result to prefixes owned by the provided namespace. That keeps foreign range references from turning into accidental id-map obligations.

## Reconciliation flow

1. Author schema with readable keys through `defineType()`, `defineScalar()`, and `defineEnum()`.
2. Call `createGraphIdMap()` to preserve existing ids and allocate ids for any new owned keys.
3. Call `applyGraphIdMap()` to inject resolved ids into the namespace and rewrite field ranges from authored keys to resolved ids when a range id is available.

## Important semantics

- `GraphIdMap.version` is part of the serialized contract. The current value is `1`.
- `createGraphIdMap()` preserves existing ids by key.
- New keys get fresh ids.
- Orphaned keys are retained unless `pruneOrphans: true` is requested explicitly.
- Invalid or duplicate ids are rejected before application.
- `applyGraphIdMap()` is strict by default and throws if any owned key is missing an id.
- `applyGraphIdMap()` mutates the provided namespace objects in place and returns the same object reference typed as resolved.

## Schema evolution rules

- Adding a field or enum option adds one new stable id and keeps existing ids intact.
- Removing a field leaves an orphaned id in the map until pruning is requested.
- Renaming a type, field-tree branch, predicate, or enum option changes the authored key, so reconciliation treats that as remove-plus-add unless you preserve the old mapping intentionally.

That behavior is not special-cased. It follows directly from key-based extraction and key-based map reuse.

## Practical rules

- Treat authored keys as the durable semantic identity you control in source.
- Treat resolved ids as the durable runtime identity you persist and ship.
- Do not hand-edit id maps into ambiguous states. Duplicate ids fail fast.
- Use `strict: false` only for narrow migration or probe paths. Normal package startup should stay strict.
