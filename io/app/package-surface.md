# App Package Surface

## Purpose

Define the kept boundary for `@io/core/app` after the app-surface cleanup. `OPE-202`
lands this shape: `@io/core/app` exports only app-owned proof contracts, and
graph-engine callers import from `@io/core/graph` directly.

The inventory below keeps the original app-owned versus graph-owned
classification explicit even though the passthrough removals are now complete.

## Kept `@io/core/app` Surface After Cleanup

`@io/core/app` should expose app-owned proof contracts only:

- `app`
- `company`
- `person`
- `status`
- `block`
- `createExampleRuntime()`
- `type ExampleSyncedClient`

Those symbols already come from:

- `../../src/app/graph/app.ts`
- `../../src/app/graph/runtime.ts`

Everything graph-engine related should come from `@io/core/graph` instead:

- schema/bootstrap/client/store/sync primitives
- `core`
- root-safe `ObjectViewSpec`, `WorkflowSpec`, and `GraphCommandSpec` contracts
- type-module authoring and reference-policy helpers
- built-in scalar, enum, and address/country modules

## Inventory

### Root export

| Path               | Classification     | Cleanup action                                                       |
| ------------------ | ------------------ | -------------------------------------------------------------------- |
| `src/app/index.ts` | compatibility-only | Keep the file and re-export only the app-owned symbols listed above. |

### `src/app/graph/*`

| Path                            | Classification          | Cleanup action                                                                |
| ------------------------------- | ----------------------- | ----------------------------------------------------------------------------- |
| `src/app/graph/app.ts`          | app-owned               | Keep. This is the app schema surface.                                         |
| `src/app/graph/runtime.ts`      | app-owned               | Keep. This is the example runtime/bootstrap proof surface.                    |
| `src/app/graph/example-data.ts` | app-owned               | Keep as internal support for `runtime.ts`; do not add it to the package root. |
| `src/app/graph/bootstrap.ts`    | graph-owned passthrough | Removed. Import from `@io/core/graph`.                                             |
| `src/app/graph/client.ts`       | graph-owned passthrough | Removed. Import from `@io/core/graph`.                                             |
| `src/app/graph/core.ts`         | graph-owned passthrough | Removed. Import from `@io/core/graph`.                                             |
| `src/app/graph/schema.ts`       | graph-owned passthrough | Removed. Import from `@io/core/graph`.                                             |
| `src/app/graph/store.ts`        | graph-owned passthrough | Removed. Import from `@io/core/graph`.                                             |
| `src/app/graph/sync.ts`         | graph-owned passthrough | Removed. Import from `@io/core/graph`.                                             |
| `src/app/graph/type-module.ts`  | compatibility-only      | Removed. Import from `@io/core/graph`.                                             |

### `src/app/type/*`

| Path                            | Classification          | Cleanup action                              |
| ------------------------------- | ----------------------- | ------------------------------------------- |
| `src/app/type/status/index.ts`  | app-owned               | Keep. This is the app-specific enum module. |
| `src/app/type/status/type.ts`   | app-owned               | Keep.                                       |
| `src/app/type/status/meta.ts`   | app-owned               | Keep.                                       |
| `src/app/type/status/filter.ts` | app-owned               | Keep.                                       |
| `src/app/type/address/index.ts` | graph-owned passthrough | Removed. Import from `@io/core/graph`.           |
| `src/app/type/boolean/index.ts` | graph-owned passthrough | Removed. Import from `@io/core/graph`.           |
| `src/app/type/country/index.ts` | graph-owned passthrough | Removed. Import from `@io/core/graph`.           |
| `src/app/type/email/index.ts`   | graph-owned passthrough | Removed. Import from `@io/core/graph`.           |
| `src/app/type/enum-module.ts`   | graph-owned passthrough | Removed. Import from `@io/core/graph`.           |
| `src/app/type/number/index.ts`  | graph-owned passthrough | Removed. Import from `@io/core/graph`.           |
| `src/app/type/slug.ts`          | graph-owned passthrough | Removed. Import from `@io/core/graph`.           |
| `src/app/type/string/index.ts`  | graph-owned passthrough | Removed. Import from `@io/core/graph`.           |
| `src/app/type/url/index.ts`     | graph-owned passthrough | Removed. Import from `@io/core/graph`.           |

## Import, Test, And Doc Updates For Cleanup

The cleanup pass should make these changes together:

- Switch app schema/runtime sources to `@io/core/graph` for graph-owned APIs:
  - `src/app/graph/app.ts`
  - `src/app/graph/example-data.ts`
- Switch graph-contract tests from local wrappers to `@io/core/graph`:
  - `src/app/graph/client-enum.test.ts`
  - `src/app/graph/client-validation.test.ts`
  - `src/app/graph/schema-range.test.ts`
  - `src/app/graph/type-module.test.ts`
  - `src/app/graph/validation-lifecycle.test.ts`
- Stop using `#graph` as an ambiguous alias in web proofs:
  - `src/app/web/company-proof.tsx`
  - `src/app/web/company-query-proof.tsx`
  - `src/app/web/explorer.tsx`
  - `src/app/web/runtime.tsx`
  - `src/app/web/relationship-proof.tsx`
- Keep app-owned imports local:
  - `../../src/app/graph/app.ts`
  - `../../src/app/graph/runtime.ts`
  - `../../src/app/type/status/index.ts`
- Update `io/app/overview.md` to describe `@io/core/app` as an app-owned surface only.
- With the imports above switched, remove the passthrough files and delete the
  `#graph` alias from `app/package.json`.
