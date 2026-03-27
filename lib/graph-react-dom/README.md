# Graph React DOM

`@io/graph-react-dom` is the canonical generic browser/DOM adapter package for
synced graph clients.

## What It Owns

- generic DOM field views and editors
- DOM filter operand editors
- browser default field and filter capability registries for generic browser
  primitives
- browser fallback rendering around the host-neutral `@io/graph-react`
  resolvers
- sanitized SVG markup rendering and SVG preview helpers

## What It Does Not Own

- host-neutral React hooks, runtime providers, and resolver primitives from
  `@io/graph-react`
- core-module-specific browser defaults from `@io/graph-module-core/react-dom`
- TUI or OpenTUI rendering
- web-app bootstrap, loading, or route-shell UI
- graph kernel, authority, bootstrap, or client runtime logic
- long-lived root `@io/core/graph/adapters/react-dom` compatibility exports

## Boundary Notes

- `@io/graph-react` stays host-neutral. This package composes browser defaults
  on top of those contracts.
- Core-coupled browser defaults now live on
  `@io/graph-module-core/react-dom`, including `GraphIcon`, tag-specific
  reference create behavior, and structured-value editors that depend on the
  built-in `core:` contracts.
- This package keeps only the generic browser adapter layer and generic browser
  primitives.

## Public API Shape

The package root exports the curated browser adapter surface from `./src`:

- `PredicateFieldView`, `PredicateFieldEditor`, `defaultWebFieldResolver`, and
  `createWebFieldResolver(...)`
- `FilterOperandEditor`, `defaultWebFilterResolver`, and
  `createWebFilterResolver(...)`
- `genericWebFieldViewCapabilities`,
  `genericWebFieldEditorCapabilities`, and
  `genericWebFilterOperandEditorCapabilities`
- `SvgMarkup` and `SvgPreview`

Run `bun test ./src` in this package to execute the colocated tests.
