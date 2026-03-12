# Graph Type Modules

## Purpose

This document is the entry point for agents working on scalar or enum families, field metadata, or filter contracts.

## Current Contract

`../src/graph/type-module.ts` already defines a real type-module authoring surface for scalar and enum families.

Current exported building blocks:

- `defineScalarModule(...)`
- `defineEnumModule(...)`
- `defineReferenceField(...)`
- `TypeModuleMeta`
- `TypeModuleFilter`
- field-level metadata and filter override types

## Current Authoring Shape

Built-in scalar families in `../src/type/*` already follow a co-located pattern:

- `type.ts`: codec and scalar definition
- `meta.ts`: display/editor metadata
- `filter.ts`: typed filter operators
- `index.ts`: assembled module export

Examples:

- `../src/type/string/`
- `../src/type/number/`
- `../src/type/date/`
- `../src/type/url/`
- `../src/type/boolean/`

Enum families already have a default module path via `../src/type/enum-module.ts`.

## Current Semantics

Type modules already provide:

- typed decoded value alignment across schema, metadata, and filter operators
- default display and editor kinds
- field-level metadata overrides
- field-level filter narrowing and default-operator overrides
- collection metadata hooks such as ordered vs unordered semantics

This is real engine code, not just a design sketch.

## Current Limits

- there is no `web.tsx` or `tui.tsx` module contract in `graph` today
- renderer/editor resolution is not implemented in this package
- entity-reference fields use `defineReferenceField(...)` and helper policies, not a richer module family yet
- richer entity-level layout and composition metadata is still mostly roadmap

## Reference-Field Helpers

`../src/graph/web-policy.ts` already provides a narrow current helper for relationship authoring:

- `existingEntityReferenceField(...)`
- `existingEntityReferenceFieldMeta(...)`

Today that helper only encodes an existing-entity-only selection policy. It is a thin field-authoring convenience, not a full UI adapter layer.

## Roadmap

- expand the current metadata/filter contract into fuller renderer/editor adapter resolution
- add stronger conventions for richer domain modules such as address-like structures
- decide how much entity-level layout metadata belongs beside schema definitions
- keep runtime-safe authoring code separate from platform adapters if those land later

## Future Work Suggestions

1. Add one “how to author a new scalar family” example that walks through `type.ts`, `meta.ts`, and `filter.ts`.
2. Document which metadata keys are already relied on by app proof surfaces.
3. Decide whether reference fields should gain their own first-class module abstraction or stay helper-based.
4. Add a small contract test suite that proves override composition across representative families.
5. Capture when `web.tsx` or `tui.tsx` belongs in this package versus an adapter package.
