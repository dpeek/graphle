# IO Graph Stream

## What This Stream Is About

This stream is about turning the graph stack into a coherent application model,
not just a UI experiment.

The repo has already shipped:

- typed refs
- type modules
- generic web field rendering
- nested, collection, and relationship proofs
- typed filter resolution and a query/filter proof

The next step is to harden the graph model so it becomes the obvious default
application surface for IO.

## Current Focus

The main priorities in this stream are now the concrete follow-on slices after
the landed validation lifecycle and total-snapshot sync contract.

### 1. Define the canonical write stream

We have typed local mutation plus authoritative total replace, but no durable
per-mutation wire shape between them.

The next work should define:

- the transaction envelope emitted by typed create/update/delete and
  predicate-ref edits
- the version/cursor metadata needed for authoritative ack or rejection
- the pending-write boundary after local validation and before remote
  confirmation

### 2. Add authoritative push/ack reconciliation

Once local writes have a stable transaction shape, the next slice is a minimal
server-authoritative read-write loop.

That means:

- clients push validated local transactions instead of saving the whole graph
- the server can accept, reject, or rewrite a transaction explicitly
- the client can reconcile or rebase pending local writes without replacing the
  entire local graph after every edit

### 3. Move normal sync traffic from snapshots to tx streams

Full snapshots should remain the bootstrap and recovery path, not the steady-
state mutation path.

The follow-on read work is:

- pull transactions or patches after a cursor
- keep predicate-slot subscriptions and typed reads stable while the delivery
  model changes under them
- let partial or query-scoped sync build on the same transaction stream later

The other graph workstreams stay important, but they should follow this sync
ordering:

- validation and built-in type work should support the same local-write and
  authoritative-reconcile result surface
- the typed graph API should stay simple while gaining push/reconcile behavior
- explorer work should expose transaction state, pending writes, and
  reconciliation outcomes once they exist

Read:

- `graph/doc/validation.md`
- `graph/doc/sync.md`
- `graph/doc/big-picture.md`
- `graph/src/graph/client.ts`
- `graph/src/graph/sync.ts`
- `app/src/graph/runtime.ts`

## Where To Look

Core graph runtime:

- `graph/src/graph/schema.ts`
- `graph/src/graph/client.ts`
- `graph/src/graph/store.ts`
- `graph/src/graph/sync.ts`
- `graph/src/graph/bootstrap.ts`
- `graph/src/graph/core.ts`
- `graph/src/graph/type-module.ts`

App and web proof surfaces:

- `app/src/graph/app.ts`
- `app/src/web/bindings.ts`
- `app/src/web/resolver.tsx`
- `app/src/web/generic-fields.tsx`
- `app/src/web/filter.tsx`
- `app/src/web/generic-filter-editors.tsx`
- `app/src/web/company-proof.tsx`
- `app/src/web/relationship-proof.tsx`
- `app/src/web/explorer.tsx`

Architecture and roadmap docs:

- `graph/doc/big-picture.md`
- `graph/doc/overview.md`
- `graph/doc/validation.md`
- `graph/doc/sync.md`
- `graph/doc/typed-refs.md`
- `graph/doc/type-modules.md`
- `graph/doc/web-bindings.md`
- `graph/doc/schema-driven-ui.md`
- `graph/doc/schema-driven-ui-implementation-plan.md`
- `graph/doc/schema-driven-ui-backlog.md`

## Long-Term Goal

Long term, the graph stack should be the foundation for a TS-native data
platform where:

- schema, data, UI semantics, and query/filter capabilities live in one model
- clients get a dead simple typed API
- sync starts simple and evolves to incremental and partial replication
- explorer/devtools make the full system inspectable
- validation and mutation semantics are coherent across local and remote flows

The target is not just a nicer schema DSL. The target is one graph-native app
runtime that can replace a pile of separate form, cache, sync, and admin
tooling.

## Good Changes In This Stream

Good work in this stream usually improves one of these:

- clarity of the core authoring model
- simplicity of the typed client API
- confidence in validation behavior
- realism of the sync story
- usefulness of the explorer as a graph devtool

If a change adds more generic abstraction but does not make the user API,
validation story, or explorer clearer, it is probably too early.
