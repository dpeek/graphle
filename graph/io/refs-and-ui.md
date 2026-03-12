# Graph Refs And UI Boundaries

## Purpose

This document is the entry point for agents working on typed refs, predicate-slot subscriptions, or UI-adjacent engine contracts.

## Current Engine Surface

The legacy docs treated typed refs as roadmap. That is no longer accurate.

`../src/graph/client.ts` already exports:

- typed `EntityRef`
- typed `PredicateRef`
- nested field-group refs
- predicate-slot subscriptions
- cardinality-aware predicate mutation methods
- `resolveEntity(...)` and `listEntities()` for relationship-aware predicate refs

## Current Ref Semantics

- refs are stable handles over one store plus one schema namespace
- predicate subscriptions are keyed to `(subjectId, predicateId)`
- `many`, `one`, and `one?` cardinality already produce different mutation APIs
- nested field groups preserve traversal shape without becoming their own reactive unit
- synced clients preserve ref ergonomics by proxy-wrapping the same typed handles rather than inventing a second graph API

Relevant source:

- `../src/graph/client.ts`
- `../src/graph/store.ts`
- `../src/graph/sync.ts`

## Current UI-Adjacent Contracts

The engine already exposes enough surface for UI work to build on:

- field metadata and filter contracts from type modules
- predicate-local subscriptions
- structured validation results suitable for inline field errors
- relationship-field helper metadata in `../src/graph/web-policy.ts`

What the engine does not currently ship:

- React hooks
- renderer resolution
- generated forms
- TUI adapters
- async option loading or relationship search infrastructure

Those remain app-level or roadmap concerns.

## Current Delineation

### Current in engine

- typed refs
- field-group traversal
- predicate-local invalidation
- cardinality-aware field mutation
- metadata/filter authoring primitives

### Still roadmap or app proof work

- generic field renderers and editors
- schema-driven form composition
- richer relationship policies beyond existing-only selection
- full collection UX conventions for every `many` field shape
- web and TUI adapter packages

## Future Work Suggestions

1. Add one short example showing a typed entity ref and a few predicate-ref mutations in code.
2. Document ref identity expectations more explicitly so UI layers do not fight the cache model.
3. Add a note about which ref methods are safe public contracts for app-level bindings.
4. Capture expected collection semantics for ordered versus unordered `many` fields before more UI proof code lands.
5. Decide whether future renderer contracts should live in `graph`, `app`, or a dedicated adapter package.
