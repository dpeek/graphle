# Graph React DOM

`@io/graph-react-dom` is the canonical browser/DOM adapter package for synced
graph clients.

## What It Owns

- DOM field views and editors
- DOM filter operand editors
- browser default field and filter capability registries
- browser fallback rendering around the host-neutral `@io/graph-react`
  resolvers
- icon rendering, sanitized SVG markup rendering, and SVG preview helpers

## What It Does Not Own

- host-neutral React hooks, runtime providers, and resolver primitives from
  `@io/graph-react`
- TUI or OpenTUI rendering
- web-app bootstrap, loading, or route-shell UI
- graph kernel, authority, bootstrap, or client runtime logic
- long-lived root `@io/core/graph/adapters/react-dom` compatibility exports

## Boundary Notes

- `@io/graph-react` stays host-neutral. This package composes browser defaults
  on top of those contracts.
- Some browser defaults still intentionally depend on the current built-in core
  module contracts:
  - tag-specific create-and-attach behavior for reference fields
  - the built-in `graph.icon.ref(...)` entity shape for `GraphIcon`
  - built-in scalar normalization helpers for duration, money, quantity, range,
    rate, and structured values
- Those assumptions remain here because they are browser defaults for the
  current built-in modules, not generic runtime ownership. When the built-in
  modules are extracted into their own workspace packages, these helpers should
  move to those owners.

## Public API Shape

The package root exports the curated browser adapter surface from `./src`:

- `PredicateFieldView`, `PredicateFieldEditor`, `defaultWebFieldResolver`, and
  `createWebFieldResolver(...)`
- `FilterOperandEditor`, `defaultWebFilterResolver`, and
  `createWebFilterResolver(...)`
- `genericWebFieldViewCapabilities`,
  `genericWebFieldEditorCapabilities`, and
  `genericWebFilterOperandEditorCapabilities`
- `GraphIcon`, `SvgMarkup`, and `SvgPreview`

Run `bun test ./src` in this package to execute the colocated tests.
