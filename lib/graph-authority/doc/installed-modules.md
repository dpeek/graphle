---
name: Graph authority installed modules
description: "Installed-module ledger validation and lifecycle planning in @io/graph-authority."
last_updated: 2026-04-07
---

# Graph authority installed modules

## Read this when

- you are changing `InstalledModuleRecord`, lifecycle planner output, or compatibility checks
- you need to understand how authored manifest identity lowers into the authoritative installed-module ledger
- you are wiring runtime rebuild or activation behavior above the shared planner seam

## Main source anchors

- `../src/contracts.ts`: installed-module contract types, validators, compatibility checks, and lifecycle planner
- `../src/contracts.test.ts`: planner and compatibility examples
- `../../graph-module/doc/module-stack.md`: cross-package manifest and
  built-in module ownership
- `../../app/src/web/lib/installed-module-manifest-loader.ts`: current host
  manifest-resolution proof for built-in and repo-local local modules
- `../../app/src/web/lib/authority.ts`: app-owned authority rebuild from
  active installed-module rows

## What this layer owns

- the authoritative installed-module ledger row
- the manifest-derived planner target
- runtime expectation checks for graph and runtime compatibility channels
- fail-closed compatibility classification
- fail-closed lifecycle plans for `install`, `activate`, `deactivate`, and `update`

It does not own bundle discovery, installer UX, manifest authoring, or runtime hook execution.

## Core shapes

- `InstalledModuleTarget`: planner-facing bundle identity derived from the manifest plus one concrete `bundleDigest`
- `InstalledModuleRuntimeExpectation`: current graph/runtime channels plus optional supported source kinds
- `InstalledModuleRecord`: authoritative installed row with source linkage, compatibility, install state, activation state, granted permissions, and timestamps

## Compatibility results

`validateInstalledModuleCompatibility()` returns one of:

- `new-install`: no existing record is present
- `matches-record`: target matches the current installed row
- `replaces-record`: version, digest, source, or compatibility differs from the current row

It fails closed for:

- invalid target, record, or runtime inputs
- module id mismatch between target and record
- unsupported source kind
- graph or runtime compatibility mismatch

## Ledger state model

- install states: `installing`, `installed`, `uninstalling`, `failed`
- desired activation states: `active`, `inactive`
- activation statuses: `activating`, `active`, `deactivating`, `inactive`, `failed`
- activation failure metadata is required when `activation.status === "failed"`
- `installState === "failed"` also requires activation failure state

In-flight rows fail closed. The planner does not guess how to resume partial transitions.

## Lifecycle planner

`planInstalledModuleLifecycle()` produces either:

- `disposition: "apply"` with pending, success, and failure state targets
- `disposition: "noop"` with an explicit reason
- a fail-closed planning error

No-op reasons are:

- `already-active`
- `already-inactive`
- `no-change`

Important planner rules:

- `install` requires a target and runtime expectation, and rejects any existing row
- `activate` requires the current installed bundle, not a replacement target
- `deactivate` applies only to the current installed bundle and stable rows
- `update` handles replacements and may preserve the current active runtime until the replacement succeeds

## Current host proof

The shared planner stays host-neutral, but the current app/web runtime now
consumes it through one explicit activation-driven proof.

Current flow:

1. `@io/app` resolves built-in manifest sources directly and resolves one
   repo-local `./...` local source path under an explicit source root.
2. Local exports are revalidated through `defineGraphModuleManifest(...)`
   before the host lowers them into contribution resolutions.
3. `createWebAppAuthority(...)` can boot from `installedModuleRecords`
   instead of a preassembled graph.
4. That host rebuild composes built-in schemas plus active installed-module
   schemas and query-surface catalogs deterministically from those rows.
5. Rebooting with the same active rows reproduces the same schema and catalog
   set; deactivating a row removes its runtime contributions fail closed.

Current limits:

- only repo-local `./...` local sources under an explicit source root are
  supported
- the first proof rebuilds schema/bootstrap state plus query-surface catalogs;
  command surfaces, object views, record surfaces, collection surfaces,
  workflows, projections, and other runtime registries do not yet load through
  installed-module activation
- activation changes are still explicit row-driven rebuilds, not hot toggles,
  uninstall cleanup, or installer UX

## Version transition semantics

- The planner always reports `fromVersion`, `toVersion`, and `requiresMigration`.
- `update` marks `requiresMigration` when the target version differs from the current record version.
- `install`, `activate`, and `deactivate` keep migration handling explicit through the returned transition and recovery text rather than hiding it in planner-local branches.

## Practical rules

- Validate and freeze target, runtime, and record inputs before branching on them.
- Keep partial or in-flight rows fail-closed until the runtime has real resume semantics.
- Treat compatibility mismatch as planner input failure, not as an invitation to guess a replacement path.
- Keep authored manifest parsing in `@io/graph-module`; this package starts at the authoritative ledger seam.

## Related docs

- [`../../app/doc/web-overview.md`](../../app/doc/web-overview.md): current
  app-owned installed-module activation and authority bootstrap proof
