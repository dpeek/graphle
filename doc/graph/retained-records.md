# Retained Records Proposal

## Purpose

Define the forward-looking persistence boundary for graph-backed workspace data
that must survive schema refactors, type splits, field renames, and authority
failures without snapshotting the entire graph.

This proposal sits above the current authoritative graph storage described in
[`./storage.md`](./storage.md). That storage keeps the live graph durable. This
document proposes how to keep selected workspace memory durable even when the
graph shape around it changes or the live graph must be rebuilt.

## Status

This document defines the current Branch 6 restore contract for the first
retained-record family.

The current implementation now proves the first retained consumer for
document-oriented workspace memory:

- authoritative writes persist canonical retained `document` and
  `document-block` rows beside the live graph
- durable restart reloads those retained rows and keeps restored workflow
  document memory readable through the live graph and workflow scopes
- retained rows can re-materialize `Document` and `DocumentBlock` facts when
  the live graph baseline must be rebuilt
- versioned retained payloads forward-migrate during load before
  re-materialization

The current implementation still does not yet extend this retained-record
contract to later families such as `WorkflowArtifact`, `WorkflowDecision`,
`ContextBundle`, or `ContextBundleEntry`.

## Logical Ownership

This proposal is primarily a Branch 6 concern built on top of Branch 1.

- Branch 6 owns the product contract for durable workspace memory: graph
  documents, workflow artifacts, decisions, context bundles, and other
  retained agent-facing records.
- Branch 1 owns the persistence substrate those records live on: the authority
  transaction model, durable storage adapter, and restart-safe recovery rules.

This is not mainly about installable module lifecycle state. It is about how a
workspace can recover durable graph-native documents and agent memory after a
bad migration, storage repair, or live-graph rebuild.

## Problem

As the graph starts storing real workspace data, not every persisted fact
should be treated the same way.

Some graph state is operational:

- current asserted edges
- retained sync history
- projection checkpoints
- derived indexes
- helper and denormalized read models

Some graph state represents durable workspace memory we explicitly want to keep
through refactors or recovery:

- graph `Document` content for notes, specs, and planning docs
- branch and commit context documents
- workflow artifacts and decisions
- retained session or context history with restore value

Persisting selected raw graph edges is too tightly coupled to the current graph
shape. A field rename, type split, cardinality change, or namespace move can be
perfectly safe at the product level while still forcing awkward graph-shape
migrations if raw edges are treated as the long-term durable contract.

The practical failure mode is simple: if an agent spends days building up graph
documents and workflow memory for one workspace, we need a way to restore those
records even if the live graph storage becomes unusable or must be rewritten.

## Recommendation

Persist canonical retained records in SQL rows with versioned JSON payloads.

Use this split:

- SQL is the durable container and transaction boundary.
- JSON payloads are the semantic record contract.
- graph facts are the live operational model materialized from those records
  for the current authority instance.
- projections and indexes remain rebuildable derived state.

This keeps durable storage tied to stable business meaning rather than to the
exact current graph predicate layout.

For the first concrete use case, the retained boundary should focus on the
document-oriented Branch 6 workspace-memory family:

- `Document`
- `DocumentBlock`

The exact record families may expand later to `WorkflowArtifact`,
`WorkflowDecision`, `ContextBundle`, and `ContextBundleEntry`, but the first
goal is to preserve authored workspace memory without requiring whole-graph
snapshots.

The first restore target is intentionally narrower than "all retained workflow
history".

It includes the document-oriented workspace-memory family whose product value
must survive a graph-baseline rewrite:

- `Document`
- `DocumentBlock`

It does not yet require the storage seam to preserve exact `AgentSession` or
`AgentSessionEvent` playback as part of retained-record restore. Those records
may remain durable graph history, but the first restore contract is about
restoring durable authored workspace memory rather than reproducing every
execution log line.

## Why SQL Plus JSON

### Why not raw selected graph facts

Raw facts are good operational state, but they are the wrong semantic boundary
for long-lived retained data.

They encode today's:

- type layout
- predicate names
- field-tree structure
- helper edges
- normalization choices

That makes durable retention too sensitive to refactors that should otherwise be
routine.

### Why not one large JSON blob

One blob is easy to start with, but it makes concurrent updates, uniqueness,
partial reads, repair, and migration bookkeeping harder than they need to be.

It is also a poor fit for the existing SQLite-backed authority direction.

### Why not JSONL as the authority

JSONL is a good log shape, not a good authority shape.

It works well for:

- export and import
- append-only audit streams
- debug and replay artifacts

It works poorly as the only canonical store for real app data because the
system still needs:

- atomic updates
- current-state lookup
- uniqueness constraints
- indexed reads
- compaction
- crash-safe recovery

Once those are required, the system has rebuilt a database around the JSONL
file. The current repo already has SQLite in the authority path, so the simpler
direction is to keep the log shape inside SQL rather than make flat JSONL files
the source of truth.

### Why not fully normalized relational tables

Fully normalizing every retained field couples durable storage too tightly to
today's schema shape.

That is appropriate for a few hot selectors and invariants, but not as the
default for migration-stable retained data.

## Proposed Storage Shape

The default retained-record shape should be:

```text
io_retained_record
- record_kind
- record_id
- version
- payload_json
- created_at
- updated_at
- deleted_at
- materialized_at_cursor
```

Optional retained-history ledger:

```text
io_retained_record_event
- seq
- record_kind
- record_id
- version
- event_kind
- payload_json
- committed_at
```

Interpretation:

- `record_kind` identifies the stable retained record family
- `record_id` is the stable logical identity of one retained object
- `version` is the payload schema version, not the graph cursor
- `payload_json` stores the canonical business object
- `deleted_at` is a tombstone for non-destructive delete semantics
- `materialized_at_cursor` records which authoritative graph baseline the row
  has been materialized into, if the runtime needs that checkpoint

For document-bearing records, a later refinement may split immutable revision
events from the current-head row. Branch 6 already has the adjacent open
question of whether `Document` should own explicit revision snapshots.

## Record Design Rules

- retained records should model semantic objects, not arbitrary graph slices
- every retained record family owns a stable `record_kind`
- every retained object owns a stable `record_id`
- payload versions are forward-migrated explicitly and idempotently
- secrets and blobs are referenced by durable handles, not embedded inline
- derived indexes may be promoted into side columns or side tables without
  becoming the canonical source of truth
- `record_kind` should name the semantic family such as `document` or
  `document-block`, not the current graph type key such as
  `workflow:document` or `workflow:documentBlock`

## First Retained Family

The first retained-record family is intentionally narrow. It covers authored
document workspace memory plus the minimum workflow document-reference seams
needed to restore meaningful Branch 6 context.

Stable retained record families for the first milestone:

- `record_kind = "document"` for one retained `Document`
- `record_kind = "document-block"` for one retained `DocumentBlock`

Version 1 `document` payloads own the canonical document-head fields needed to
re-materialize the current `Document` meaning:

- stable logical document identity at `record_id`
- title, optional description, optional slug, and archive state
- tag references or equivalent stable tag identity data needed to restore tags

Version 1 `document-block` payloads own the canonical ordered child surface for
one `DocumentBlock`:

- stable logical block identity at `record_id`
- owning `documentId`
- `order`
- `kind: "markdown" | "entity" | "repo-path"`
- the block-local fields required to restore the authored body or include
  target for that kind

For `DocumentBlock.kind`, the retained payload meaning is:

- `markdown`: authored markdown text remains canonical retained content
- `entity`: the payload keeps the referenced graph-entity identity as data, not
  as a recoverable raw edge list
- `repo-path`: the payload keeps the repository path include as data while git
  remains authoritative for the file content

The first retained family does not yet include:

- `DocumentPlacement`
- `DocumentLink`
- `WorkflowArtifact`
- `WorkflowDecision`
- `ContextBundle`
- `ContextBundleEntry`

### Required Workflow-Linked Document References

Restoring only retained `Document` and `DocumentBlock` rows is not enough to
recover meaningful Branch 6 context. The first milestone must also preserve the
workflow document-reference slots that point at restored documents:

- `WorkflowBranch.goalDocumentId`
- `WorkflowBranch.contextDocumentId`
- `WorkflowCommit.contextDocumentId`

These are semantic workflow slots, not a reason to retain arbitrary raw graph
edges. Restore should re-bind those slots to restored `Document` identities, or
surface them as unresolved repair items when the target document cannot be
materialized.

## Materialization Model

The intended runtime flow is:

1. authoritative write updates one or more retained records
2. the same authority transaction materializes the corresponding graph facts
3. derived projections or indexes rebuild incrementally from graph state or the
   retained record ledger

That gives the system three distinct layers:

- retained records: semantic durability layer
- graph facts: live operational model
- projections and indexes: rebuildable read layer

The graph remains central to the product. It is just no longer forced to be the
only recovery-grade representation of every durable workspace object.

## Restore Semantics

Restore in Branch 6 means re-establishing the durable workspace-memory surface
from retained records after forward migration. It does not mean reproducing the
exact prior graph encoding, retained sync window, or every derived read model
byte for byte.

### First restore target

The first retained-record restore target is:

- `Document`
- `DocumentBlock`
- workflow document-reference slots on `WorkflowBranch.goalDocumentId`,
  `WorkflowBranch.contextDocumentId`, and `WorkflowCommit.contextDocumentId`

A successful restore must preserve, for every retained object in that set:

- stable retained identity at the `(record_kind, record_id)` boundary for
  `Document` and `DocumentBlock`
- canonical payload meaning after applying forward migrations
- semantic parent-child membership and ordering for ordered `DocumentBlock`
  records
- workflow document-reference slot meaning for branch goal and branch or commit
  context documents
- `DocumentBlock.kind` meaning for `markdown`, `entity`, and `repo-path`
- tombstones and non-destructive delete intent, so deleted objects are not
  resurrected by rebuild
- unresolved repair state when a referenced entity, repository path target, or
  workflow document target cannot be re-materialized cleanly

### Restorable Versus Rebuildable

Restore must recreate the selected durable workspace surface. It may rebuild or
replace the operational graph surfaces around it.

Restorable durable state:

- canonical retained rows for the first restore target
- migrated payload JSON and stable retained ids
- semantic document membership and ordered block composition
- workflow goal and context document references on branches and commits
- document content plus document-block include intent

Rebuildable derived or operational state:

- graph facts materialized from restored payloads
- helper edges, denormalized read models, and computed indexes
- Branch 3 projections, query indexes, and checkpoint rows
- retained sync windows, cursor ranges, and other incremental-replay
  boundaries
- `materialized_at_cursor` checkpoints used only to coordinate
  re-materialization

### Restore Does Not Promise

- byte-for-byte recreation of the previous graph rows, tx ids, or cursors
- preservation of every helper edge or transient read model that once existed
- preservation of local runtime state such as locks, worktree leases, PTYs, or
  in-memory session buses
- exact replayable `AgentSession` or `AgentSessionEvent` history as part of the
  first retained-record restore target
- inclusion of `WorkflowArtifact`, `WorkflowDecision`, `ContextBundle`, or
  `ContextBundleEntry` in the first retained family

### Failure Expectations

Restore should fail closed per retained object, not by silently dropping or
inventing workspace memory.

- if retained sync history is pruned or unusable, the first restore target
  still restores from retained rows
- if projections are lost or incompatible, rebuild them from restored graph
  facts or directly from retained records
- if the live graph baseline must be rewritten, re-materialize restored records
  into a fresh baseline rather than preserving the old graph shape
- if one retained record cannot be migrated or materialized, keep its canonical
  row for repair, mark that object unresolved, and continue restoring unrelated
  records when safe
- if a referenced entity, repository path target, or workflow document target
  is missing, preserve the retained row and surface the missing reference as
  repairable data loss rather than erasing the parent record

## When To Promote Fields Out Of JSON

Keep fields inside `payload_json` by default.

Promote a field into indexed SQL columns or side tables only when one of these
is true:

- the field participates in uniqueness checks
- the field is a common lookup key
- the field drives scheduling or retention scans
- the field is needed for selective rebuilds without decoding every row
- the field has join-heavy read paths that are operationally important

Promoted columns remain helpers around the canonical payload, not replacements
for it.

## Migration Contract

Retained-record migrations should be:

- forward-only in the stable contract
- idempotent per `(record_kind, record_id, from_version, to_version)` step
- explicit about semantic changes rather than graph-shape rewrites
- applied before graph materialization rather than during ad hoc graph repair

The preferred migration surface is:

```ts
type RetainedRecordMigration = {
  recordKind: string;
  fromVersion: number;
  toVersion: number;
  migrate(payload: unknown): unknown;
};
```

Graph materialization then consumes the migrated canonical payload rather than
trying to infer workspace meaning from partially stale graph facts.

If a migration step is missing or fails for one retained object, restore should
leave that object's canonical payload untouched for repair instead of
materializing a partial best-effort graph shape.

## Relationship To Existing Graph Storage

[`./storage.md`](./storage.md) should remain the canonical doc for the current
SQLite Durable Object authority tables and commit path.

This document adds a second boundary above it:

- `storage.md`: how the live authoritative graph is stored today
- `retained-records.md`: how selected durable workspace data should survive
  refactors, recovery, and graph-baseline rewrites over time

If this contract later hardens into the implemented storage seam, its primary
home should move under Branch 6 with a smaller Branch 1 note covering the
storage seam needed to support it.
