# Managed Module Stream Workflow Plan

Status: Active implementation plan.

## Purpose

This plan keeps the managed-module-stream work narrow. The main contracts are
now defined elsewhere; follow-on work should implement them in order instead of
reopening the contract on each issue.

## Stable Contract Sources

- label and parent ownership contract:
  [`./managed-stream-goals.md`](./managed-stream-goals.md)
- parent brief and child backlog shape:
  [`./managed-stream-backlog.md`](./managed-stream-backlog.md)
- `@io` comment trigger model:
  [`./managed-stream-comments.md`](./managed-stream-comments.md)
- branch, worktree, and landing lifecycle:
  [`../doc/stream-workflow.md`](../doc/stream-workflow.md)

## Phase 1 Landed

The first managed-stream slice is now in place for the `agent` module:

1. managed parent identity comes from `io` plus exactly one configured module
   label
2. module docs and allowed shared paths come from `modules.<id>` in `io.ts`
3. `@io` comments are parsed and tracked through the Linear adapter
4. parent managed-brief writeback has a stable marker shape
5. stream-aware scheduling and workspaces already serialize child execution per
   parent stream

## Implementation Order

1. validate managed parent identity as `io` plus exactly one configured module
   label, and surface ambiguity clearly
2. keep `./io/goals.md` refreshable from `@io focus` using the stable repo-wide
   goals shape
3. ingest `@io backlog`, `@io focus`, `@io status`, and `@io help` comments
   through the tracker layer
4. connect comment commands to the allowed write surfaces without rewriting
   human-owned issue prose
5. keep operator-visible summaries stable across issue body updates, child
   backlog maintenance, and comment replies
6. prove the same flow on `graph` and capture any portability fixes without
   reintroducing module-specific path assumptions

## Out Of Scope For This Slice

- free-form natural-language comment parsing
- multiple active child runs inside one stream
- replacing Linear parent or `blockedBy` semantics
- inventing new managed marker ids beyond the reserved set in
  `./managed-stream-goals.md`

## Done Means

The stream is coherent when routing, parent writeback, child backlog
maintenance, focus-doc refresh, and comment-triggered updates all target the
same label rules, marker ids, and ownership boundaries.
