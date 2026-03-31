# Graph Type Modules

## Purpose

This document is the entry point for scalar and enum families, field metadata
and filter contracts, plus the pure object-view, record-surface,
collection-surface, workflow, command-surface, and command contracts that live
beside graph-owned types.

## Package Surfaces

`../../lib/graph-module/src/type.ts` defines the module-authoring
surface. `../../lib/graph-module/src/index.ts` re-exports the curated authoring
subset, and `../../lib/graph-module/src/contracts.ts` holds the pure shared
contracts for object views, record surfaces, collection surfaces, workflows,
command surfaces, and command descriptors.

Naming:

- `@io/graph-module` is the extracted workspace package
- "graph modules" are concrete authored namespace slices such as `core` and
  `workflow`
- "type modules" are the reusable `{ type, meta, filter, field(...) }`
  authoring objects returned by `defineScalarModule(...)`,
  `defineEnumModule(...)`, and the packaged defaults

Canonical imports:

- `@io/graph-module`: focused schema and type-module authoring helpers from
  `../../lib/graph-module/src/index.ts`, including `TypeModule`,
  `ObjectViewSpec`, `RecordSurfaceSpec`, `CollectionSurfaceSpec`,
  `WorkflowSpec`, `GraphCommandSurfaceSpec`, and `GraphCommandSpec`
- `@io/app/graph`: small root helper surface for curated kernel aliases,
  and icon helpers
- `@io/graph-module-core`: canonical built-in `core:` namespace plus the
  extracted core-owned type modules, datasets, bootstrap inputs, and helper
  contracts
- `@io/graph-authority`: authority-owned permission/admission/share contracts
  such as `ModulePermissionRequest` and `ModulePermissionApprovalRecord`

Exported building blocks in `../../lib/graph-module/src/type.ts`
include:

- `defineScalarModule(...)`
- `defineEnumModule(...)`
- `defineReferenceField(...)`
- `defineSecretField(...)`
- `TypeModule`
- `TypeModuleMeta`
- `TypeModuleFilter`
- field-level metadata and filter override types

`../../lib/graph-module/src/index.typecheck.ts` and nearby module/type tests
show the intended usage in real code.

## Secret-Field Contract

`defineSecretField(...)` is the shared Branch 1 helper for authoring
secret-backed predicates without importing consumer transport code.

The frozen contract is:

- the field range points at the core-owned `core:secretHandle` type
- the helper publishes the shared secret-field contract consumed by
  `workflow:envVar` and any other secret-backed slice; no consumer type owns that
  contract
- the returned field authority always includes `visibility: "replicated"` and
  `write: "server-command"` unless the caller narrows those shared field-policy
  values explicitly
- `authority.secret` is the stable `GraphSecretFieldAuthority` shape with
  `kind: "sealed-handle"` plus optional metadata visibility and capability keys
- those capability keys are opaque Branch 1 schema metadata, not a published
  reveal flow or principal-aware enforcement surface
- command routing, request envelopes, and secret-storage adapters stay outside
  this helper and belong to consumer packages such as `web`
- provider metadata semantics and external KMS bindings are outside this helper
  and remain provisional

## Authored Surface Naming And Compatibility

- `ObjectViewSpec` remains the compatibility-oriented current record-view
  descriptor for callers that already traffic in object-view keys.
- `RecordSurfaceSpec` is the preferred authored record-surface name for new
  work. It intentionally reuses the object-view field and section shapes so
  authored layout data can migrate without reshaping.
- `CollectionSurfaceSpec` is the current authored collection export. This doc
  may still use "collection view" as the product concept, but downstream
  callers should not invent a second root `CollectionView` contract.
- `WorkflowSpec` remains the stable authored flow descriptor and still
  references `objectView` and raw `command` keys as the current compatibility
  seam while record-surface and command-surface composition stabilizes.
- `GraphCommandSpec` owns execution mode, I/O, and policy only. Dialog,
  sheet, confirmation, and post-success UI behavior belong on
  `GraphCommandSurfaceSpec`.

## `ObjectViewSpec`

Use `ObjectViewSpec` for reusable, host-independent object presentation
metadata that belongs with one type or a very small slice of related types.
It remains the current compatibility-oriented seed for the broader
record-surface model.

Current fields:

- `key` and `entity` identify the view and its subject type
- `titleField` and `subtitleField` point at summary predicates when helpful
- `sections` groups reusable field layout metadata
- `related` lists reusable related-entity presentations such as `list`,
  `table`, or `board`
- `commands` advertises direct command keys the compatibility view can surface

This contract stays pure data. React composition, DOM layout, route ownership,
and browser event handling stay out of it.

## `RecordSurfaceSpec`

Use `RecordSurfaceSpec` for the first explicitly named record-surface contract
that sits between schema metadata and route-local UI composition.

Current fields:

- `key` and `subject` identify the record surface and its subject type
- `titleField` and `subtitleField` preserve the current summary-field affordance
- `sections` reuses the object-view field and section shape for a direct
  migration path
- `related` references reusable collection-surface keys instead of embedding
  route or host ownership
- `commandSurfaces` lists referenced command-surface keys the host may surface
  for the record

This keeps the authored contract pure data while creating a durable bridge
from today's object-view layout metadata to broader record-surface work.

## `CollectionSurfaceSpec`

Use `CollectionSurfaceSpec` for the first authored collection-surface contract
that can describe durable list, table, board, or card-grid surfaces without
pulling in route, transport, or React ownership.

Current fields:

- `key`, `title`, and optional `description`
- `source`, where the first authored kinds are `entityType`, `relation`, and
  `query`
- `presentation.kind` for the high-level renderer hint
- `presentation.fields` and optional `presentation.recordSurface` for basic
  column or card binding hints
- `commandSurfaces` for referenced command-surface keys the host may surface
  at the collection level

This stays intentionally narrow. Query execution, selection state, create
flows, and authoritative command wiring still belong to later layers.

## `WorkflowSpec`

Use `WorkflowSpec` for reusable, declarative multi-step flows that reference
object-view keys and command keys without turning the graph root into a route
layer.

Current fields:

- `key`, `label`, and `description`
- `subjects` for the type keys the workflow applies to
- `steps`, where each step may reference an `objectView` key or a `command`
  key
- `commands` for any workflow-level command affordances

Type-local workflows can live beside a type. Cross-type workflows can live in a
small graph-owned workflow module, but the contract itself stays root-safe.
That compatibility seam is intentional: keep workflow steps keyed to
`ObjectViewSpec` and `GraphCommandSpec` until the broader record-surface and
command-surface host composition is proven end to end.

## `GraphCommandSpec`

Use `GraphCommandSpec<Input, Output>` for a durable command descriptor that
captures execution mode, I/O shape, and policy without embedding the
authoritative implementation.

Current fields:

- `key`, `label`, and optional `subject`
- `execution`: `localOnly`, `optimisticVerify`, or `serverOnly`
- `input` and `output`
- optional `policy.capabilities`, reusing the shared authorization capability-key vocabulary
- optional `policy.touchesPredicates`, where each entry names a touched `predicateId`

The descriptor belongs in `@io/graph-module`. The authoritative
implementation, transport wiring, and route ownership still belong in `app`.
Do not move human-invocation details such as sheets, dialogs, confirmation, or
post-success navigation onto this type; those stay on
`GraphCommandSurfaceSpec`.

## `GraphCommandSurfaceSpec`

Use `GraphCommandSurfaceSpec` for the authored UI-facing layer that describes
how a human invokes one `GraphCommandSpec` without moving execution or policy
ownership out of the command descriptor.

Current fields:

- `key` and `command`, where `command` references the durable
  `GraphCommandSpec.key`
- optional `label` and `icon` overrides for the invocation affordance
- `subject`, where the first authored models are `none`, `entity`,
  `selection`, and `scope`
- `inputPresentation`, where the first authored kinds are `inline`, `dialog`,
  `sheet`, and `dedicatedForm`
- `submitBehavior`, where the first authored kinds are `optimistic`,
  `blocking`, and `confirm`
- `postSuccess` for follow-up behaviors such as `refresh`, `close`,
  `navigate`, and `openCreatedEntity`

Record and collection surfaces now reference command-surface keys rather than
raw command keys so the UI-facing invocation layer stays explicit in authored
surface composition.

## `ModulePermissionRequest`

Use `ModulePermissionRequest` for the canonical manifest-facing install-time
permission union shared by Branch 2 authorization lowering and Branch 4 module
planning.

Current fields:

- stable base fields: `key`, `reason`, and `required`
- graph-policy kinds: `predicate-read`, `predicate-write`,
  `command-execute`, `secret-use`, and `share-admin`
- host-expansion placeholders that already occupy the same permission-key
  space: `external-service`, `background-job`, and `blob-class`

The stable contract is the request union itself plus the `key` space it lowers
into for approval, grant, and revocation. Installers and UIs may summarize
these requests, but they should not invent a second incompatible manifest
shape.

## `ModulePermissionApprovalRecord`

Use `ModulePermissionApprovalRecord` for the durable authority-owned decision
record attached to one declared module permission key.

Current fields:

- identity fields: `moduleId`, `permissionKey`, and the reviewed `request`
- decision fields: `status`, `decidedAt`, `decidedByPrincipalId`, and optional
  notes
- explicit lowerings: one or more `module-permission` capability grants or
  role bindings for `approved` and `revoked`, and an empty lowering list for
  `denied`
- revocation fields: `revokedAt`, `revokedByPrincipalId`, and optional
  `revocationNote` when a previously approved permission is later revoked

This keeps install-time permission review durable without creating hidden
ambient rights. Module permission approvals always lower to explicit grants or
role bindings, and denials remain durable records rather than disappearing
from audit history.

## Canonical Module Layout

Built-in graph modules now live under their owning package trees:

- `../../lib/graph-module-core/src/app/` for `core:` families
- `../../lib/graph-module-workflow/src/` for public `workflow:` slices
- `../../lib/graph-module-core/src/app.ts` and
  `../../lib/graph-module-workflow/src/index.ts`: namespace assembly entrypoints
- `../../lib/graph-module-workflow/src/env-var/schema.ts` and
  `../../lib/graph-module-workflow/src/document/schema.ts`: internal slice
  entrypoints

Examples:

- `../../lib/graph-module-core/src/app/date.ts`
- `../../lib/graph-module-core/src/app/url.ts`
- `../../lib/graph-module-core/src/app/email.ts`
- `../../lib/graph-module-core/src/app/string.ts`
- `../../lib/graph-module-core/src/app/number.ts`
- `../../lib/graph-module-core/src/app/boolean.ts`
- `../../lib/graph-module/src/enum.ts`
- `../../lib/graph-module/src/string.ts`

## Per-Type Authoring Layout

Common files in the current tree:

- `type.ts`: canonical type definition or codec
- `meta.ts`: host-neutral metadata when needed
- `filter.ts`: typed filter operators when needed
- `kind.ts`: sibling enum or helper definitions when a slice needs them
- `index.ts`: root-safe slice aggregator
- `schema.ts`: namespace slice entrypoint for exported subpaths
- `data.ts`: static enum data when needed

Not every slice needs every file. Keep the type or slice directory as the
authoring boundary and publish it through the canonical module subpaths above.

## Root-Safe Export Rule

Physical colocation and package export ownership are separate concerns.

- published type and slice entry files must stay root-safe for
  `@io/graph-module`, `@io/app/graph`, or the module subpaths
- root-safe exports may include canonical schema, metadata, filters, pure view
  specs, pure command descriptors, and reusable fixtures
- published module entry files must not import browser APIs, OpenTUI code, or
  route registration helpers
- host-specific composition belongs on `@io/graph-react` for host-neutral React
  contracts or `@io/graph-module-core/react-dom` for the current default
  browser implementation

## Authoring Semantics

Type modules provide:

- typed decoded value alignment across schema, metadata, and filter operators
- default display and editor kinds
- field-level metadata overrides
- field-level filter narrowing and default-operator overrides
- collection metadata hooks such as ordered versus unordered semantics
- a `field(...)` method that freezes one field definition against those shared
  defaults

## Reference Fields

`@io/graph-module` exports the relationship-authoring helpers:

- `existingEntityReferenceField(...)`
- `existingEntityReferenceFieldMeta(...)`

These helpers encode the existing-entity selection policy plus the most common
UI hints that travel with it, such as collection semantics, subject exclusion,
and explicit collection editor kinds. The React and DOM adapter layers consume
that policy without moving host widgets or route code into the root module
surface.
