# App Overview

## Purpose

`app` is the proof surface for IO's graph-native application model: example
schema, runtime bootstrap, and web UI proofs built on top of `graph`.
`@io/core/app` stays limited to app-owned schema/runtime contracts, with the app
consuming graph-owned authoritative persistence rather than owning reusable
engine and type-module APIs. The first operator-facing env-var route also lives
here.

## Docs

- `./package-surface.md`
- `./experiments.md`
- `./env-vars.md`
- `../graph/overview.md`
- `../graph/architecture.md`
- `../graph/runtime.md`
- `../graph/sync.md`
- `../graph/type-modules.md`
- `../graph/refs-and-ui.md`

## Layout

- `../../src/app/index.ts`: app-owned package exports
- `../../src/app/experiments/`: experiment-local graph registration, seed, and route registration,
  with promoted reusable schema imported from `../../src/graph/schema/`
- `../../src/app/graph/`: app namespace composition over the canonical graph schema tree, runtime
  bootstrap, example data, client proofs
- `../../src/app/authority.ts`: app proof composition around `@io/core/graph` persisted authority helpers, including bootstrap, seed data, and snapshot-path resolution
- `../../src/app/server-app.ts`, `../../src/app/server.ts`: thin HTTP proof transport over graph-owned sync and persistence surfaces
- `../../src/app/web/`: shared shell/runtime, resolver, bindings, explorer, proof screens, operator settings,
  browser runtime
- `../../src/app/env-vars.ts`: app-owned env-var route wiring and runtime helpers
- `../../src/app/**/*.test.ts*`: proof and regression coverage
