# App Experiment Contract

## Purpose

Define the internal structure for adding a new app experiment without growing
more flat schema, route, and runtime wiring files.

## Layout

Each experiment lives under `../src/experiments/<name>/`.

- `graph.ts`: experiment-owned schema exports plus the graph registration entry
- `seed.ts`: optional example-runtime seed hook for proof data
- `web.ts`: experiment-owned route registration for the shared shell
- optional colocated UI/binding files when the slice is ready to move out of the
  current flat proof files

Current examples:

- `../src/experiments/company/`: company schema plus company/query/relationship
  proof routes
- `../src/experiments/outliner/`: block schema plus outliner route
- `../src/experiments/env-vars/`: env-var and secret-ref schema plus settings
  route
- `../src/experiments/explorer/`: route-only graph tooling slice

## Shared Contracts

These files stay shared app infrastructure rather than experiment-local code:

- `../src/experiments/contracts.ts`: typed experiment graph and web contracts
- `../src/experiments/graph.ts`: registry that merges experiment schema and
  seed hooks
- `../src/experiments/web.ts`: registry that merges experiment routes
- `../src/graph/app.ts`: app namespace composed from registered experiment
  schema
- `../src/graph/example-data.ts`: example runtime seeding composed from
  registered experiment hooks
- `../src/web/runtime.tsx`: shared synced runtime bootstrap
- `../src/web/app-shell.tsx`: shared shell, navigation, and canonical route
  behavior

## Registration Rules

When adding a new experiment:

1. Create `../src/experiments/<name>/graph.ts` if the slice owns schema or seed
   wiring.
2. Create `../src/experiments/<name>/web.ts` if the slice owns routed UI.
3. Add the graph definition to `../src/experiments/graph.ts` and the web
   definition to `../src/experiments/web.ts`.
4. Keep runtime bootstrap, shell behavior, and generic bindings in shared app
   infrastructure unless the new slice proves a reusable contract should move.

Route keys, route paths, and schema member names must stay unique across all
registered experiments. The registry tests cover that contract.
