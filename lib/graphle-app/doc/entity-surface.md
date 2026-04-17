---
name: App entity surface wrappers
description: "App proof wrappers around the shared @dpeek/graphle-surface interactive entity surfaces."
last_updated: 2026-04-17
---

# App entity surface wrappers

## Read this when

- you are changing app proof entity detail or create wrappers
- you need the ownership split between shared entity surfaces and
  `@dpeek/graphle-surface`
- you need to preserve app-only secret-field behavior while using the shared
  surface stack

## What this doc owns

This doc owns only the proof app wrappers around shared entity surfaces:

- dialog chrome around create bodies
- app catalog lookup glue
- app-specific secret-field editor override
- legacy import shims while older app files migrate

It does not own generic row planning, row chrome, predicate rendering,
create-draft support, authored record metadata, or readonly record binding.
Those live in `@dpeek/graphle-surface`, `@dpeek/graphle-react`, and
`@dpeek/graphle-module`.

## Current landing in tree

- `../src/web/components/entity-surface.tsx`: thin live wrapper over
  `@dpeek/graphle-surface/react-dom` that supplies the app secret editor
- `../src/web/components/create-entity-surface.tsx`: app dialog wrapper around
  `CreateEntitySurfaceBody`
- `../src/web/components/entity-surface-plan.ts`: re-export shim for shared
  planner types and helpers
- `../src/web/components/field-editor-row.tsx`: re-export shim for shared
  `PredicateRow`
- `../src/web/components/inspector.tsx`: app inspector shell plus a section
  wrapper that supplies the app secret editor when needed
- `../src/web/components/explorer/create-draft-plan.ts`: app-only create
  defaults for proof data such as workflow order and tag colors
- `../src/web/components/explorer/create-draft-controller.ts`: legacy test
  fixture around the shared draft controller; new shared create rendering uses
  `CreateEntitySurfaceBody`
- `../src/web/components/entity-type-browser.tsx` and
  `../src/web/components/collection-browser-surface.tsx`: app-owned detail
  flows that now render the live surface directly
- `../src/web/components/entity-create-button.tsx`: app-owned create entry
  that now renders the shared draft surface directly

## Exported family

- `EntitySurface`: app proof wrapper for live entity detail
- `CreateEntitySurface`: app proof dialog wrapper for create flows
- generic product packages should import from
  `@dpeek/graphle-surface/react-dom`, not from app
- do not add a second app-owned generic entity surface beside the shared
  package implementation

## Responsibilities

- pass the app sync runtime as the shared mutation runtime
- provide `SecretFieldEditor` through the shared `renderEditor(...)` override
- keep dialog close buttons, cancel actions, and create labels in app/web
- keep explorer catalog selection and route behavior in app/web
- leave row policy, field widgets, validation display, and draft controllers in
  the shared packages

## Row planning and chrome

`buildLiveEntitySurfacePlan(...)` is now exported by
`@dpeek/graphle-surface`. It flattens live predicate refs, preserves authored
or field-tree order for non-system rows, then assigns one of four shared roles:

- `title`
- `body`
- `meta`
- `hidden`

Each row also carries shared chrome policy:

- label visibility
- description visibility
- validation placement

`PredicateRow` resolves those policies per mode, delegates field views and
controls to `@dpeek/graphle-module-core/react-dom`, and merges external
validation messages with row-local mutation errors.

## Create flow

`CreateEntitySurfaceBody` in `@dpeek/graphle-surface/react-dom` decides which
fields stay in the generic create path, creates draft predicate refs through
`createEntityDraftController(...)`, validates submit issues, and calls the
host's create callback. The app wrapper supplies explorer catalog lookup,
proof-only defaults, and the dialog footer.

## Boundary against readonly record surfaces

- `RecordSurfaceSpec` stays the authored structure contract: subject,
  title/subtitle fields, section metadata, and related collection keys
- `resolveRecordSurfaceBinding(...)` stays a readonly lookup adapter over field
  values and related collections
- `RecordSurfaceMount*` stays the readonly shell for browse-only record
  layouts; it is not the edit path
- shared entity surfaces may reuse `RecordSurfaceSectionView` chrome, but
  interactive behavior stays out of readonly binding

Do not move surface policy such as `name` promotion, system-field hiding,
explicit edit mode, or validation placement into `RecordSurfaceSpec`.

## Adapter path from `RecordSurfaceSpec`

The intended adapter path is:

1. start from authored `RecordSurfaceSpec.sections`, or from
   `adaptObjectViewToRecordSurface(...)` while older `ObjectViewSpec` data is
   still in flight
2. keep authored section order, titles, labels, and descriptions as metadata
3. resolve those field paths against live predicate refs or the draft field
   tree, not through `resolveRecordSurfaceBinding(...)`
4. map the resolved rows into shared row roles and chrome defaults
5. render them through `PredicateRow` plus `EntitySurfaceFieldSection`

That path keeps the authored contract narrow. `RecordSurfaceSpec` still says
"what fields exist and how they are grouped." The shared entity surface decides
"how an interactive product screen should behave" while hosts provide shell and
app-only overrides.

## Related docs

- [`./web-overview.md`](./web-overview.md): current app-owned web and Worker
  runtime map
- [`../../graph-surface/doc/record-surfaces.md`](../../graph-surface/doc/record-surfaces.md):
  readonly record-surface binding and adapter boundary below this layer
- [`../../../doc/branch/07-web-and-operator-surfaces.md`](../../../doc/branch/07-web-and-operator-surfaces.md):
  Branch 7 product-surface contract
- [`../../../pdr/entity-surface.md`](../../../pdr/entity-surface.md): delivery
  plan for the exported surface family
