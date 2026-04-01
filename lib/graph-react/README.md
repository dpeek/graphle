# Graph React

`@io/graph-react` is the host-neutral React layer for synced graph clients.

It owns the edit-session contracts, validation helpers, predicate hooks,
predicate-slot subscription hook, generic draft-value helpers, generic
entity-draft controller core, and the synced runtime React context/hooks.

## What It Does Not Own

- DOM widgets, browser-only field editors, or renderer composition
- module-authored catalogs, scopes, or schema definitions
- sync transport and client construction APIs
- app-specific explorer or create-flow composition

## Public API Shape

The package root re-exports the curated host-neutral surface from `./src`:

- edit-session contracts
- validation issue modeling and aggregation helpers
- predicate hooks and metadata helpers
- `usePredicateSlotValue(...)`
- draft-value helpers such as `cloneDraftValue(...)`, `sameLogicalValue(...)`,
  `getDraftValue(...)`, `setDraftValue(...)`, and `removeDraftItem(...)`
- `createEntityDraftController(...)`
- synced runtime provider, context, sync-state, and query hooks

## Build Output

Run `turbo build --filter=@io/graph-react` from the repo root, or `bun run build`
in this package, to emit `./out`.
Run `turbo check --filter=@io/graph-react` from the repo root, or
`bun run check` in this package, to lint, format, type-check, and execute the
colocated Bun tests.
