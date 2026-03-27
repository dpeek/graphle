# Graph Adapters

## Purpose

`../../lib/graph-react/src/` and `../../lib/graph-react-dom/src/` define the
graph workspace's host-neutral React and browser-specific adapter surfaces.

## Public Entry Surfaces

- `@io/graph-react`: `../../lib/graph-react/src/index.ts`; graph-aware,
  host-neutral React hooks, resolver primitives, mutation helpers, and synced
  runtime hooks
- `@io/graph-react-dom`: `../../lib/graph-react-dom/src/index.ts`; DOM field
  views and editors, filter resolvers, icon rendering, SVG preview helpers,
  and field-family modules

There is no separate `react-opentui` package anymore. TUI code imports the
shared runtime hooks directly from `@io/graph-react`.

## Source Layout

- `../../lib/graph-react/src/entity.tsx`,
  `../../lib/graph-react/src/predicate.ts`,
  `../../lib/graph-react/src/filter.tsx`,
  `../../lib/graph-react/src/mutation-validation.ts`,
  `../../lib/graph-react/src/persisted-mutation.tsx`,
  `../../lib/graph-react/src/resolver.tsx`,
  `../../lib/graph-react/src/runtime.tsx`: host-neutral React helpers
- `../../lib/graph-react-dom/src/field-registry.tsx`,
  `../../lib/graph-react-dom/src/filter.tsx`,
  `../../lib/graph-react-dom/src/filter-editors.tsx`,
  `../../lib/graph-react-dom/src/icon.tsx`,
  `../../lib/graph-react-dom/src/resolver.tsx`: DOM adapter exports and
  capability registries
- `../../lib/graph-react-dom/src/fields/`: DOM field-family view/editor
  modules and shared preview helpers

`@io/graph-react-dom` stays browser-specific. It composes the host-neutral
contracts from `@io/graph-react` into default browser field and filter
capabilities.
