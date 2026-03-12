# App Goals

## Objective

- Prove the graph stack through a realistic application surface instead of isolated runtime demos.
- Keep the example schemas, queries, explorer, and web bindings aligned with the graph package contract.

## This Week

- Use the app package to expose friction in the new type-module and field-authoring APIs instead of papering over it with app-local helpers.
- Expand the explorer and proof screens so validation, query shape, and relationship behavior stay inspectable from the UI.
- Keep query, filter, and mutation-validation proofs current with the graph runtime as sync and validation contracts harden.

## Constraints

- The app package is a proof surface for `graph`, not a fork of it; reusable runtime logic should land in `graph` when the abstraction is real.
- UI proofs should make schema and data behavior more visible, not hide it behind app-specific shortcuts.
- Validation results should stay structurally aligned with the shared graph lifecycle so UI feedback matches runtime behavior.

## Proof Surfaces

- `../src/graph/app.ts`
- `../src/graph/client.ts`
- `../src/graph/schema.ts`
- `../src/graph/sync.ts`
- `../src/web/bindings.ts`
- `../src/web/resolver.tsx`
- `../src/web/filter.tsx`
- `../src/web/generic-fields.tsx`
- `../src/web/generic-filter-editors.tsx`
- `../src/web/company-proof.tsx`
- `../src/web/company-query-proof.tsx`
- `../src/web/relationship-proof.tsx`
- `../src/web/explorer.tsx`

## Related Docs

- `./overview.md`
- `../../graph/io/goals.md`
- `../../io/overview.md`
- `../../graph/doc/overview.md`
- `../../graph/doc/schema-driven-ui.md`
- `../../graph/doc/schema-driven-ui-implementation-plan.md`
- `../../graph/doc/schema-driven-ui-backlog.md`
