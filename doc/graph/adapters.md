# Graph Adapters

## Purpose

`../../lib/graph-react/src/`, `../../lib/graph-react-dom/src/`, and
`../../lib/graph-module-core/src/react-dom/` define the graph workspace's
host-neutral React, generic browser-adapter, and core-module-specific browser
adapter surfaces.

## Public Entry Surfaces

- `@io/graph-react`: `../../lib/graph-react/src/index.ts`; graph-aware,
  host-neutral React hooks, resolver primitives, mutation helpers, and synced
  runtime hooks
- `@io/graph-react-dom`: `../../lib/graph-react-dom/src/index.ts`; generic DOM
  field views and editors, filter resolvers, SVG rendering helpers, and the
  generic browser capability registries
- `@io/graph-module-core/react-dom`:
  `../../lib/graph-module-core/src/react-dom/index.ts`; core-owned browser
  defaults such as `GraphIcon`, structured-value editors, and tag-aware
  entity-reference behavior

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
  generic capability registries
- `../../lib/graph-react-dom/src/fields/`: generic DOM field-family
  view/editor modules and shared preview helpers
- `../../lib/graph-module-core/src/react-dom/field-registry.tsx`,
  `../../lib/graph-module-core/src/react-dom/icon.tsx`,
  `../../lib/graph-module-core/src/react-dom/resolver.tsx`: core-owned browser
  defaults layered on top of the generic DOM adapter
- `../../lib/graph-module-core/src/react-dom/fields/`: structured-value,
  tag-reference, and other core-coupled DOM field modules

`@io/graph-react-dom` stays browser-specific and generic. It composes the
host-neutral contracts from `@io/graph-react` into reusable browser field and
filter capabilities. `@io/graph-module-core/react-dom` owns the browser
defaults that depend on the built-in `core:` namespace.
