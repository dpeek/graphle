# Graph Module Core

`@io/graph-module-core` is the canonical workspace package for the built-in
`core:` namespace.

## What It Owns

- the canonical `core` namespace assembly
- built-in core scalar, enum, entity, dataset, and helper contracts
- `coreGraphBootstrapOptions`
- the built-in icon seed catalog and icon-resolution helpers
- structured-value parsing, normalization, and formatting helpers
- core-owned identity, admission, share, locale, country, and currency schema
- core-specific browser defaults from `@io/graph-module-core/react-dom`

## What It Depends On

- `@io/graph-module` for schema authoring helpers
- `@io/graph-kernel` for id reconciliation and low-level schema contracts
- `@io/graph-bootstrap` for bootstrap-facing option contracts

## What It Does Not Own

- generic type-module authoring helpers from `@io/graph-module`
- host-neutral React runtime contracts from `@io/graph-react`
- generic DOM/browser wrappers from `@io/graph-react-dom`
- the still-root-owned `workflow:` module tree
- module installation, activation, or runtime registry logic

## Browser Defaults

The `@io/graph-module-core/react-dom` subpath owns the browser defaults that
depend on built-in core value contracts and entity shapes, including:

- `GraphIcon`
- core structured-value editors and helpers
- tag-aware entity-reference create-and-attach behavior
- the default built-in field resolver bundle for the current core module

Generic DOM resolver wrappers, SVG rendering, and generic browser primitives
stay on `@io/graph-react-dom`.
