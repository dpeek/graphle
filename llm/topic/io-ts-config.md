# IO TypeScript Config Model

Status: Proposed

## Why This Exists

`io` currently treats `io.json` as the structured configuration entrypoint.
That works for runtime validation, but it leaves the system with three gaps:

- config is not a typed source module that the rest of the repo can import
- plugin and provider config shapes are not modeled as reusable interfaces
- the future graph/UI story would need a second schema for the same fields

The current implementation reflects that split:

- `agent/src/workflow.ts` parses `io.json` directly
- `cli/src/install.ts` parses `io.json` directly
- `lib` exports shared runtime utilities, but not a shared config definition surface

This proposal defines what it should look like to move the machine-readable
config from `io.json` to `io.ts` without collapsing `io.md` back into a giant
prompt/config hybrid.

## Current Repo Constraints

The proposal needs to fit the repo as it exists today:

- the root workspace currently contains `agent`, `cli`, `graph`, and `lib`
- there is no dedicated `config` workspace package yet
- `agent/src/workflow.ts` owns the current runtime `io.json` loading path
- `cli/src/install.ts` separately reads `io.json` for install-oriented config
- package exports and typechecking are centered on per-package `src` trees

Those constraints drive two design decisions:

- the config source should remain at the repo root so the user edits one file
- packages should consume config through a workspace package boundary instead of
  reaching outside their own source roots with relative imports

## Goals

- make `io.ts` the single repo-owned structured config source
- let the rest of the application stack consume one typed exported object
- keep config authoring strict and ergonomic in TypeScript
- define provider and plugin config shapes modularly
- reuse those same config shapes for future graph-backed editing
- keep `io.md` as the natural-language instruction/context entrypoint

## Non-Goals

- implementing the migration in this issue
- replacing `io.md`
- moving all config storage into the graph on day one
- allowing arbitrary async or side-effect-heavy config modules

## Proposed File Model

- `./io.ts`
  - user-authored structured config source
- `./io.md`
  - repo-local instruction/context document
- `@io/lib/config`
  - shared config helpers, types, descriptors, and loader utilities
- `@io/config`
  - thin workspace package that re-exports the repo root `io.ts`

The important part is that the user-owned source stays `./io.ts`, but the rest
of the repo imports it through a normal workspace package boundary instead of
reaching up into the repo root with relative imports.

That packaging layer matters because the current package configs all typecheck
`src` only, and several of them set `rootDir` to `src`. Importing `../io.ts`
directly from each package would force broader per-package `tsconfig` changes
and would make emit/layout behavior harder to reason about.

## Authoring Contract

The repo should export a single default config object from `io.ts`.

```ts
import {
  defineIoConfig,
  definePluginConfig,
  defineProviderConfig,
  env,
  linearTracker,
} from "@io/lib/config";

export default defineIoConfig({
  agent: {
    maxConcurrentAgents: 1,
    maxRetryBackoffMs: 300_000,
    maxTurns: 1,
  },
  codex: {
    approvalPolicy: "never",
    command: "codex app-server",
    threadSandbox: "workspace-write",
  },
  context: {
    entrypoint: "./io.md",
  },
  install: {
    brews: ["ripgrep", "bat"],
  },
  plugins: {
    github: definePluginConfig({
      enabled: true,
    }),
  },
  providers: {
    linear: defineProviderConfig({
      apiKey: env.secret("LINEAR_API_KEY"),
      projectSlug: env.string("LINEAR_PROJECT_SLUG"),
    }),
  },
  tracker: linearTracker({
    activeStates: ["Todo"],
    apiKey: env.secret("LINEAR_API_KEY"),
    projectSlug: env.string("LINEAR_PROJECT_SLUG"),
  }),
  workspace: {
    root: env.path("AGENT_WORKSPACE_ROOT"),
  },
});
```

Key properties of this contract:

- the config is authored in TypeScript, not JSON
- the config is validated through the helper surface, not ad hoc object shapes
- the final exported value remains serializable/config-like
- environment-backed values are explicit instead of being hidden string
  conventions

## Shared Config Surface In `@io/lib`

`@io/lib/config` should become the single place that defines the config model.

It should expose:

- `defineIoConfig(...)`
  - validates top-level structure and preserves exact inference
- `defineProviderConfig(...)`
  - standard way for provider modules to declare their config shape
- `definePluginConfig(...)`
  - standard way for plugin modules to declare their config shape
- `env`
  - typed helpers such as `env.string(...)`, `env.secret(...)`, and `env.path(...)`
- `loadIoConfig(...)`
  - shared runtime loader used by `agent`, `cli`, and other packages

The important design rule is that `@io/lib` owns the config language, while
`io.ts` only supplies repo-specific values.

The first pass should cover the shapes that already exist in runtime config
today:

- agent runtime settings
- codex execution settings
- hooks and polling settings
- tracker settings
- workspace settings
- install-oriented settings such as `brews`

That keeps the migration grounded in the current repo contract before adding
new provider or plugin descriptor families.

## Provider And Plugin Shapes

Provider and plugin configuration should be modular rather than one giant
top-level interface.

Each module should own a descriptor that includes:

- its stable kind/key
- its TypeScript config shape
- field metadata
- runtime validation rules
- defaults where appropriate

Conceptually, each descriptor looks like this:

```ts
type ConfigDescriptor<T> = {
  fields: ConfigFieldMap<T>;
  parse(value: unknown): T;
  kind: string;
};
```

That gives the system one place to answer all of these questions:

- what keys are valid?
- what type does each field have?
- which values are required, optional, enum-like, secret, or path-like?
- how should the runtime validate the final object?
- how should a UI render an editor for the same object?

## Graph-Driven Metadata

The graph should become the schema layer for config, not necessarily the first
storage layer.

The same provider/plugin descriptors should be able to project into graph-shaped
metadata:

- section keys
- field keys
- scalar kinds
- required/optional flags
- enum choices
- labels and descriptions
- secret/value-source markers

That creates one shared model for:

- TypeScript inference in `io.ts`
- runtime validation in loaders
- graph-backed inspection
- future structured config editing UI

The first phase should keep `io.ts` as the source of truth and treat any graph
projection as derived metadata. Editing through the graph can come later once
the descriptor model is stable.

## TypeScript Wiring

The current package layout means the repo needs an explicit access path for the
root `io.ts`.

Recommended approach:

1. keep the user-authored file at `./io.ts`
2. add a thin `config` workspace package published internally as `@io/config`
3. make `@io/config` re-export the repo root `io.ts`
4. have other packages import `@io/config` instead of `../io.ts`

This avoids widening every package `include`/`rootDir` just to reach the repo
root, while still making the config available everywhere as a normal typed
module.

`@io/config` is also the right place to isolate any loader/build quirks that are
specific to the repo-owned config source.

## Runtime Contract

The runtime should stop parsing `io.json` independently in multiple places.

Instead:

- `agent`
- `cli`
- future packages that need config

should all call the same shared loader from `@io/lib/config`.

That loader should:

- import `@io/config`
- validate the default export against the shared config model
- resolve environment-backed values consistently
- return one normalized typed object

The config module should stay synchronous and side-effect-light so it remains:

- predictable to load
- safe to import from tooling
- easy to inspect and eventually project into a UI

## Compatibility Contract During Rollout

The migration should preserve the current repo behavior while establishing
`io.ts` as the source of truth.

Recommended loader order:

1. if `io.ts` exists, load it through `@io/config` and normalize it through the
   shared `@io/lib/config` loader
2. if `io.ts` is absent, continue accepting `io.json` through the same shared
   loader surface
3. if both files exist during migration, treat `io.ts` as authoritative and use
   `io.json` only as compatibility input or generated output

That compatibility layer matters because this repo already uses `io.json` for
two different concerns:

- `agent` runtime configuration
- `cli` install configuration

The migration should consolidate those reads behind one loader before removing
JSON authoring as a first-class source format.

## Migration Shape

This should ship as a phased migration, not a flag day rewrite.

### Phase 1

- add the `@io/lib/config` helper surface
- add `@io/config`
- allow authoring `io.ts`
- keep `io.json` as the compatibility path

### Phase 2

- move `agent` and `cli` to the shared TypeScript config loader
- keep `io.json` as a fallback or compatibility import path during migration
- update docs that still describe JSON as the primary structured config boundary

### Phase 3

- move provider/plugin definitions onto modular descriptors
- derive graph field metadata from those descriptors
- expose config inspection/editing through the graph/UI layer

### Phase 4

- deprecate direct `io.json` authoring once `io.ts` is stable
- keep any needed machine-readable export as generated output rather than source

## Effect On Existing IO Docs

This proposal does not change the role of `io.md`.

It does imply follow-up updates to docs that currently describe `io.json` as the
long-term config entrypoint, especially:

- `agent/doc/context.md`
- `agent/doc/context-defaults.md`

Those docs should be updated as part of the implementation work, not in this
planning issue.

## Recommended Implementation Plan

1. Add `@io/lib/config` with `defineIoConfig`, env helpers, and shared
   loader/normalization logic.
2. Introduce a thin `@io/config` workspace package that re-exports the repo root
   `io.ts`, so the rest of the repo can import typed config without widening
   every package `rootDir`.
3. Migrate `agent` and `cli` from direct `io.json` parsing to the shared config
   loader, keeping a compatibility path during rollout.
4. Move provider/plugin config onto reusable descriptors and project those
   descriptors into graph metadata for future structured editing.
