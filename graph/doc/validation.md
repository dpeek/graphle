# Graph Validation Lifecycle

Sources:

- `graph/src/graph/schema.ts`
- `graph/src/graph/type-module.ts`
- `graph/src/graph/client.ts`
- `graph/src/graph/sync.ts`

## Rule Ownership

Validation rules live with schema authoring, not with mutation entry points.

- Runtime graph invariants own store-dependent structural checks.
  - Required/cardinality enforcement and entity-reference integrity depend on
    the current graph state, so they surface as `source: "runtime"` issues.
  - Single-value cardinality counts current facts, not just deduped logical
    values, so duplicate authoritative facts for one/optional fields are
    rejected even when they encode the same value.
  - Node typing is also runtime-owned. The shared `core:node:type` predicate is
    managed by the typed entity handle locally, and authoritative snapshots
    reject data-bearing nodes that arrive without any current type edge.
- Type modules and scalar definitions own reusable value semantics.
  - `defineScalar({ encode, decode, validate })` is the right place for rules
    that should apply anywhere that scalar is used.
  - Scalar codecs may reject wrong local JS input kinds or malformed
    authoritative payload values before those values normalize into graph
    state; scalar `validate` then owns semantic checks on decoded values.
  - Current shipped example: `core:number` rejects non-finite values.
  - Enum definitions also contribute reusable value semantics through their
    allowed member ids.
  - Current shipped example: enum-backed fields reject ids that are not members
    of the declared enum and surface those issues as `source: "type"`.
- Field definitions own predicate-specific invariants.
  - `*.field({ validate })` or `defineReferenceField({ validate })` should
    express rules that depend on one specific predicate.
  - Current shipped example: `core:node:name` rejects blank strings.
- Mutation entry points orchestrate lifecycle only.
  - `create`, `update`, `delete`, and predicate-ref mutation helpers do not
    define new rules.
  - They normalize input or simulate the requested state transition, run
    validation, and only then write to the store.

This keeps type-family semantics, field semantics, and runtime mutation flow
separate.

## Lifecycle

### 1. Local mutation precheck

Local create/update and typed field mutations all use the same pipeline:

1. clone the requested input
2. run `onCreate` / `onUpdate` lifecycle hooks to synthesize managed values
3. validate the normalized value shape
4. validate scalar/type rules
5. validate field-level rules
6. simulate the post-mutation graph on a cloned store and run graph validation
7. commit to the real store only if that simulated graph validation succeeds

That simulated graph pass keeps the surrounding local mutation context
(`phase: "local"` plus `event: "create" | "update" | "delete"`), so scalar and
field validators can distinguish optimistic local checks from authoritative
reconciliation without branching on which helper invoked them.
Within that simulated graph pass, validators now see the specific predicate
slot currently being rechecked in `changedPredicateKeys` rather than a broad
"all fields on this entity" set. The earlier normalized-input precheck still
exposes the full requested local mutation set, including lifecycle-managed
predicates such as `updatedAt`.

Create preflight and create commit also share a stable predicted node id for the
current local store version, so validator and lifecycle hook context does not
drift between `validateCreate(...)` and the subsequent `create(...)` call.
That post-apply graph boundary is also where runtime entity-reference integrity
is decided, so lifecycle-managed create values can safely point at the new node
id without failing before the simulated type edge exists.

This is the current optimistic-write boundary. Invalid input never enters the
local store.

`createSyncedTypeClient(...).graph` uses that same precheck before any sync
call happens. Synced clients queue write transactions only after that same
validated local commit succeeds; the write queue does not introduce a second
optimistic validation path.

Callers that need the normalized result without committing can run the same
precheck directly:

- `graph.<type>.validateCreate(input)`
- `graph.<type>.validateUpdate(id, patch)`
- `graph.<type>.validateDelete(id)`
- `graph.<type>.ref(id).validateUpdate(patch)`
- `graph.<type>.ref(id).validateDelete()`
- typed predicate refs expose the same non-throwing preflight at the field
  boundary:
  - single/optional fields: `validateSet(...)`
  - optional fields: `validateClear()`
  - many fields: `validateReplace(...)`, `validateAdd(...)`,
    `validateRemove(...)`, `validateClear()`
- many-field remove preflight validates the requested removal target against
  the field range before treating absent items as a no-op.
  - Current shipped example:
    `graph.person.ref(personId).fields.worksAt.validateRemove(otherPersonId)`
    fails with `reference.type` instead of silently succeeding.

Managed structural predicates stay outside caller control inside that precheck.

- Current shipped example: typed entity handles reject direct edits to
  `core:node:type`, including no-op restatements of the current type, and keep
  the owning type stable.
- Typed update/delete entry points also reject targets that do not currently
  carry the handle's entity type.
  - Current shipped examples: `graph.company.update(personId, ...)` fails with
    a runtime `type.mismatch` issue on `type`, and
    `graph.company.delete(missingId)` fails with `node.missing` instead of
    silently no-oping.

Typed deletes use the same boundary, but validate a simulated post-delete
snapshot before retracting facts from the real store.

- Current shipped example: deleting a company that is still referenced by
  `person.worksAt` fails locally with the same structured runtime issues used by
  sync reconciliation.
- Validators reached through that simulated post-delete graph still see
  `phase: "local"` and `event: "delete"` rather than the authoritative
  reconcile context used for remote sync.
- Local create/update now use that same post-apply graph boundary too, so a
  typed mutation cannot commit on top of an already-invalid local graph state.
  - Current shipped example: creating a company while another local company has
    already lost its required `name` fails with the same runtime
    `field.required` issue instead of committing the new entity alongside that
    invalid graph state.

### 2. Local committed state

After a local mutation commits, typed reads, predicate-slot subscriptions, and
UI bindings continue to observe the same logical values they already used. The
validation path does not introduce a second field representation.

### 3. Server-authoritative reconciliation

`createSyncedTypeClient(...).sync.sync()` now validates incoming total snapshots
before replacing the local store.

The current total-sync path is:

1. fetch payload
2. validate the total-sync envelope (`mode`, `scope`, `cursor`,
   `completeness`, `freshness`, and `snapshot` shape)
3. materialize the candidate apply snapshot by layering the bootstrapped schema
   baseline back in when the client configured `preserveSnapshot`
4. run `validateAuthoritativeTotalSyncPayload(payload, namespace, { preserveSnapshot })`
   against that candidate graph
5. reject the payload if either validation pass fails
6. only then replace the real local store
7. publish `ready`

This means authoritative data uses the same rule set as local mutation, but at
the sync boundary instead of trusting remote data implicitly.

What v1 sync does not do yet is merge pending local writes into an incoming
authoritative total snapshot. Once a total snapshot passes validation, it still
replaces the local store authoritatively and clears any queued local write txs.

That sync boundary is now centralized in the shared total-sync session.

- `createSyncedTypeClient(...)` installs the validator for the default typed
  client path.
- Lower-level sync integrations can pass
  `createAuthoritativeTotalSyncValidator(namespace)` into
  `createTotalSyncController(..., { preserveSnapshot, validate })` or
  `createTotalSyncSession(..., { preserveSnapshot, validate })`.
- Callers that need structured results without throwing can inspect
  `validateAuthoritativeTotalSyncPayload(..., { preserveSnapshot })` directly.
  - When envelope shape validation succeeds, `result.value` is the
    materialized authoritative payload that graph validation actually checked,
    including any preserved schema baseline.
- `apply(...)` and `pull(...)` therefore use one authoritative validation
  boundary instead of duplicating snapshot checks in separate wrappers.
- Successful `apply(...)` and `pull(...)` calls now return that same
  materialized payload, so callers can inspect the exact snapshot that was
  validated and installed after any preserved schema baseline is layered in.
- That preserved baseline should be the store snapshot captured immediately
  after local schema bootstrap. This keeps local typed mutation validation
  coherent after a data-only authoritative replace.

Authority-side write application now uses that same authoritative validation
boundary too.

- `validateAuthoritativeGraphWriteTransaction(tx, store, namespace)` applies the
  canonical write ops to a cloned store snapshot, runs `validateGraphStore(...)`
  with `phase: "authoritative"` and `event: "reconcile"`, and returns the same
  structured `GraphValidationResult`
- `createAuthoritativeGraphWriteSession(store, namespace)` commits only after
  that cloned-store validation passes, so invalid remote writes leave the real
  authoritative store unchanged
- accepted tx ids are stored as idempotency keys for the session:
  - replaying the same canonical transaction returns the original cursor safely
  - reusing the same id for a different canonical transaction fails with a
    structured runtime validation issue at `id`
- this write path does not invent new rule ownership:
  - scalar and enum definitions still own reusable value semantics
  - field definitions still own predicate-specific validation
  - runtime graph invariants still come from the shared `validateGraphStore(...)`
    pass after the candidate post-apply graph is materialized

### 4. Future partial sync

The same model should extend to patch or query-scoped sync later:

- local draft/edit paths stay on pre-commit validation
- authoritative remote data validates at the apply boundary
- explorer or devtools surfaces can render the same issue objects regardless of
  whether they came from local edits or sync reconciliation

Async or server-only validation is still future work. The current contract is
deliberately synchronous and deterministic.

## Result Surface

Validation currently surfaces as one structured result type with two access
patterns.

- Local mutation preflight callers can inspect `GraphValidationResult`
  directly through typed entity and predicate-ref `validate*` helpers.
- Local mutation commit helpers still throw `GraphValidationError` when that
  same result is not `ok`.
- Sync reconciliation failures also throw `GraphValidationError`.
- Sync-envelope failures use that same result shape too, with runtime issues
  rooted at payload paths such as `cursor` or `snapshot.edges[0].id`.
- Generic web editors now call predicate-ref `validate*` helpers before they
  invoke the mutating `set` / `add` / `remove` / `clear` methods.
- Explorer field rows still receive `GraphValidationError`, but that error is
  now created from the shared preflight result instead of depending on a thrown
  mutator path for invalid local edits.
- `GraphValidationResult` and `GraphValidationError.result` include:
  - `source`: `runtime | type | field`
  - `code`
  - `message`
  - `path`
  - `predicateKey`
  - `nodeId`
- failed local and authoritative results both include `changedPredicateKeys`
  so callers can target the attempted or affected predicate slots without
  re-deriving that list from raw issues
- successful local preflight also returns the normalized mutation payload,
  including lifecycle-managed values such as `createdAt` and `updatedAt`
- predicate clear preflight surfaces cleared fields as explicit `undefined`
  entries in that normalized payload instead of leaking internal mutation
  sentinels to callers or `GraphValidationError.result`
- authoritative total-sync validation also returns the payload it validated in
  `result.value`, so direct callers can inspect the exact materialized snapshot
  without having to run `apply(...)`
- authoritative write validation returns the canonical transaction it validated
  in `result.value`, so direct callers and replay handling can compare the
  exact tx identity/content that reached the apply boundary
- `formatValidationPath(issue.path)` converts the stored path into an explorer-
  or form-friendly field string.

This is enough for callers and explorer surfaces to show targeted inline errors
without inventing a second validation format or relying on exceptions for every
local check.

## Proof Surfaces

The contract above is covered by runtime tests rather than only prose.

- `graph/src/graph/client-validation.test.ts` proves the shared local preflight
  path for typed create/update/delete and predicate-ref mutations.
- `graph/src/graph/validation-lifecycle.test.ts` proves validator ownership,
  lifecycle phase/event context, and parity between local mutation and
  authoritative reconciliation.
- `graph/src/graph/sync.test.ts` proves the authoritative sync/apply boundary,
  including direct non-throwing validation and thrown sync failures consuming
  the same structured result shape.

## Shipped End-To-End Path

The first durable path now proves the contract in real runtime code:

- field rule: `core:node:name` rejects blank names
- type rule: `core:number` rejects non-finite values
- type rule: built-in scalar codecs reject wrong local JS input kinds for
  typed number/boolean/url fields and reject malformed authoritative boolean
  payloads before install
- enum-backed fields reject unknown enum member ids as type-owned validation
- runtime rule: entity references must point at an existing node of the declared
  range type
- runtime rule: data-bearing nodes must retain a current `type` edge, and typed
  entity handles treat that field as managed
- local create/update/delete and typed predicate-ref mutations share the same
  validation pipeline
- total sync rejects invalid authoritative snapshots before local replacement
- total sync also rejects malformed sync envelopes before graph validation or
  local replacement
