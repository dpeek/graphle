---
name: Graph query installed surfaces
description: "Installed query-surface registry, renderer compatibility, and editor-catalog projection in @io/graph-query."
last_updated: 2026-04-07
---

# Graph query installed surfaces

## Read this when

- you are changing installed query-surface registry behavior
- you need to understand how module catalogs become one installed runtime
- you are tracing renderer compatibility or query-editor catalog projection

## Main source anchors

- `../src/query-surface-registry.ts`: installed surface registry and renderer compatibility projection
- `../src/query-editor-catalog.ts`: installed-surface to query-editor catalog mapping
- `../src/query-surface-registry.test.ts`: duplicate-id and compatibility coverage
- `../../app/src/web/lib/query-surface-registry.ts`: app-owned browser-safe built-in catalog composition
- `../../app/src/web/lib/installed-module-query-surface-loader.ts`: app-owned
  authority-side activation and installed-module catalog loading
- `../../app/src/web/lib/installed-module-manifest-loader.ts`: app-owned
  manifest loading for built-in and repo-local local modules
- `../../app/src/web/lib/authority.ts`: authority-side saved-query validation
  against the activation-composed registry
- `./query-stack.md`: broader cross-package query ownership

## What this layer owns

- flattening installed module query-surface catalogs into one runtime registry
- attaching `moduleId`, `catalogId`, and `catalogVersion` to each installed surface
- the smaller renderer-compatibility contract consumed by query containers and saved views
- projecting installed surfaces into the query-editor catalog

It does not own manifest activation, built-in module selection, or module-authored query-surface specs themselves.

## Registry semantics

- installed catalogs must be non-empty
- `catalogId` values must be non-empty and unique across the installed set
- `surfaceId` values must be non-empty and unique across the installed set
- the registry exposes `catalogs`, flattened `surfaces`, and `surfaceById`

The uniqueness rule is fail-closed on purpose. Once surfaces are installed, `surfaceId` is the runtime identity used by saved queries, query execution, and browser bindings.

## Renderer compatibility projection

`createQuerySurfaceRendererCompatibility(...)` keeps only the container-facing compatibility data:

- `compatibleRendererIds`
- `queryKind`
- `resultKind`
- optional `sourceKinds`
- optional `itemEntityIds`
- `surfaceId`
- `surfaceVersion`

That smaller contract is what query-container validation and saved-view compatibility should depend on. They do not need the whole module catalog shape.

## Editor-catalog projection

`createQueryEditorCatalogFromInstalledSurfaces(...)` converts installed surfaces into authoring surfaces:

- filter field kinds are mapped to editor controls through `query-editor-value-semantics.ts`
- installed catalog metadata stays attached so saved-query compatibility can compare current and stored versions later
- the result stays React-free and can be used by root helpers or `react-dom`

## Current app/web activation proof

The generic registry stays host-neutral, but the current app/web proof now
feeds it from installed-module activation instead of a fixed catalog list.

Current behavior:

- `@io/app` resolves built-in manifests plus one repo-local `./...` local
  installed-module source under an explicit `localSourceRoot`
- `installed-module-query-surface-loader.ts` combines the built-in
  core/workflow catalogs with the active installed-module rows and projects
  that same registry into the shared query-editor catalog
- `query-surface-registry.ts` stays browser-safe and exposes the built-in
  registry helpers consumed by client components
- `authority.ts` validates saved-query writes and surface lookups against that
  same activation-composed registry and editor catalog, so removed or inactive
  surfaces fail closed instead of widening silently

## Practical rules

- Keep installed runtime metadata attached to surfaces all the way through the editor and saved-query layers.
- Fail closed on duplicate or blank ids instead of letting ambiguity leak into execution or persistence.
- Keep activation-driven composition in app code. The generic installed-surface runtime belongs here.
- Keep activation-driven catalog composition, editor-catalog projection, and
  authority-side saved-query validation on the same installed-surface registry
  source.
