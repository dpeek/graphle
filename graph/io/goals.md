# Graph Goals

## Objective

- Turn the graph stack into the default application model for IO, not just a schema and UI experiment.
- Keep schema, validation, query, sync, and explorer semantics coherent enough that new work naturally uses the graph surface.

## This Week

- Finish the migration to the new type-module and field-authoring APIs so remaining compatibility seams shrink instead of growing.
- Harden the validation lifecycle with richer built-in scalar and field helpers while preserving one shared result surface across local and sync flows.
- Keep the typed client and sync story simple:
  typed queries, predictable completeness, and a total-sync baseline that can later grow into partial replication.
- Expand explorer/devtool coverage so schema, data, query, and validation state remain inspectable.

## Constraints

- Reusable value semantics belong with scalar and enum definitions; predicate-specific rules belong with fields; runtime invariants stay centralized in validation/apply boundaries.
- The user-facing API should get simpler over time, not more generic for its own sake.
- Sync design should start from a coherent total-sync contract instead of overfitting to incremental cases too early.

## Proof Surfaces

- `../src/graph/schema.ts`
- `../src/graph/client.ts`
- `../src/graph/store.ts`
- `../src/graph/sync.ts`
- `../src/graph/bootstrap.ts`
- `../src/graph/core.ts`
- `../src/graph/type-module.ts`
- `../src/type`

## Related Docs

- `./overview.md`
- `../../app/io/goals.md`
- `../../io/overview.md`
- `../doc/overview.md`
- `../doc/big-picture.md`
- `../doc/validation.md`
- `../doc/sync.md`
- `../doc/typed-refs.md`
- `../doc/type-modules.md`
- `../doc/web-bindings.md`
- `../doc/schema-driven-ui.md`
- `../doc/schema-driven-ui-implementation-plan.md`
- `../doc/schema-driven-ui-backlog.md`
