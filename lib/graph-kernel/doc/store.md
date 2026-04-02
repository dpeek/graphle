---
name: Graph kernel store
description: "Append-oriented fact storage, snapshots, and predicate-slot subscriptions in @io/graph-kernel."
last_updated: 2026-04-02
---

# Graph kernel store

## Read this when

- you are changing `createGraphStore()` or `GraphStore`
- you need to reason about assertions, retractions, snapshots, or subscription behavior
- you are debugging lookup semantics or store version changes

## Main source anchors

- `../src/store.ts`: store contract and in-memory implementation
- `../src/store.test.ts`: lookup, replacement, version, and subscription behavior
- `../src/index.ts`: graph-prefixed export names

## Data model

- `GraphFact` is one asserted edge: `id`, `s`, `p`, `o`.
- `GraphStoreSnapshot` is the full materialized store state: `edges` plus the list of retracted edge ids.
- `EncodedValue` is still just a string id at this layer. Scalar decoding belongs above the store.

The store is schema-agnostic. It does not know about cardinality, field metadata, validation, or transport.

## Mutation semantics

- `newId()` allocates a fresh opaque id but does not create a node record.
- `assert()` allocates an edge id automatically.
- `assertEdge()` accepts a complete edge record.
- Re-asserting the same edge id with identical contents is a no-op.
- Re-asserting the same edge id with different contents throws.
- `retract(edgeId)` tombstones by edge id and may refer to an id whose edge payload is not present locally.

The store is append-oriented. Assertions add facts. Retractions preserve history by id instead of deleting rows.

## Read semantics

- `find()` returns asserted edges even if they have since been retracted.
- `facts()` filters retracted edge ids out of the result.
- `get()` returns the first live object value for one `(subject, predicate)` slot. It is a convenience helper, not a cardinality check.

The current implementation maintains subject, predicate, object, and pair indexes internally, but the public contract is still pattern lookup rather than index management.

## Predicate-slot subscriptions

- Subscriptions are keyed by one logical `(subjectId, predicateId)` slot.
- Notifications are coalesced until the outermost `batch()` completes.
- Listeners fire only when the slot's live value list changes after retraction filtering.
- Raw edge churn that leaves the live slot value unchanged does not notify.
- Writes to unrelated predicates do not notify the slot.

This is the contract that higher reactive layers build on. The store does not publish a broader event bus.

## Snapshots and replacement

- `snapshot()` deep-clones the current materialized state.
- `replace()` rebuilds the store from a provided snapshot, rebuilds indexes, and reevaluates any observed predicate slots before notifying listeners.
- `cloneGraphStoreSnapshot()` exists for callers that need a detached copy without a store instance.

## Version semantics

- The version starts at `0`.
- It increments for each new assertion.
- It increments for the first retraction of an edge id.
- It increments for each full `replace()` call.
- Repeating the same retraction does not increment the version again.

## Practical rules

- Do not put schema logic in the store.
- Do not assume `find()` only returns live facts.
- Do not assume `get()` proves the slot is `one` or `one?`.
- If you need logical field replacement, do it in a `batch()` so slot listeners see one coalesced change.
