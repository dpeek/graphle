# Managed Module Stream Contract

Status: Accepted target for the first managed-stream implementation pass.

## Purpose

This document defines the first concrete contract for turning a repo module into
an IO-managed stream. Follow-on implementation work should target these rules
instead of inventing new label, comment, or issue-body shapes per feature.

## Managed Parent Label Contract

A parent issue is managed only when all of the following are true:

- the issue has no parent
- the issue has the `io` label
- the issue has exactly one module label that matches a configured module id
- the issue is intended to accumulate child issues on one stream branch

Rules:

- `io` means the parent opts into agent-managed sections and `@io` comment
  triggers
- `io` never identifies the module; the module label does
- child issues do not need the `io` label; they inherit stream membership from
  `parentId`
- removing `io` disables managed-parent behavior without deleting the
  human-authored brief
- zero or multiple module labels are a blocking ambiguity that the human must
  fix before managed automation continues

## Module Identity Contract

Module identity comes from `io.ts` or `io.json` under `modules.<id>`.

Example:

- label: `agent`
- module id: `agent`
- primary path: `./agent`

Rules:

- the issue label must match the module id after lowercase normalization
- `modules.<id>.path` is the canonical primary implementation root
- `modules.<id>.docs` are the default context docs for that module
- `modules.<id>.allowedSharedPaths` define the shared repo paths that are still
  considered in-bounds for a module-local child
- each child issue keeps one primary module label for routing, context
  narrowing, and operator scanning
- cross-module work requires an explicit exception in the child description;
  touching shared code does not change primary module identity

## Current Approach Parent Phase Contract

For the current 2-level bootstrap, the parent issue state is the only automatic
phase gate between backlog work and child execution.

Parent phases:

- `Todo`: backlog-authoring phase; automatic backlog polling may select the
  managed parent only in this state
- `In Review`: human review and edit hold state after backlog work; keep the
  parent parked here until a human is ready to release execution
- `In Progress`: execution-released state; unblocked child issues may now run
- `Done`: stream-complete state; no new backlog or child execution should be
  scheduled automatically

Rules:

- managed parents keep backlog routing in every non-terminal phase so explicit
  backlog reruns and top-level `@io` commands still land on the backlog agent
  while the parent is in `Todo`, `In Review`, or `In Progress`
- automatic backlog scheduling stops once the parent leaves `Todo`
- child readiness is determined by the parent phase plus child-local
  `blockedBy` ordering and the one-active-child-per-stream rule
- the current approach keeps planning, review, and approval on the parent;
  children remain implementation-only

## Current Approach Transition Contract

Parent backlog work and child execution keep separate Linear transitions even
while they share one stream branch.

Rules:

- a successful parent backlog run moves the parent to `In Review`
- moving the parent to `In Progress` is a human-controlled release step; it
  does not imply any child state transition
- a successful child execution run moves only that child to `Done`
- child completion does not move the parent out of its current phase

## Parent Description Template

The top-level managed parent issue description is the canonical evolving brief
for the stream. Managed refreshes should move the description toward one shared
markdown template rather than splitting state across protected blocks or
separate focus docs.

Recommended shape:

```md
## Objective

- one or two bullets defining the shipping outcome

## Current Focus

- the next one to three concrete work areas

## Constraints

- repo or stream rules that narrow the work

## Proof Surfaces

- repo paths or docs that must stay aligned

## Work Options

1. **Option 1**
   Focus: ...
   Alignment: ...

## Deferred

- work intentionally outside the current slice
```

Rules:

- humans and agents both edit the same parent description
- agents should normalize toward the recommended headings when refreshing the
  brief, but they do not require an exact starting template
- preserve useful human-authored sections when possible, especially decisions,
  approvals, and notes that still help execution
- `Proof Surfaces` should use repo-relative paths
- `Work Options` are the canonical child-backlog planning surface for managed
  reruns
- package `*/io/goals.md` docs may still exist as repo docs, but they are not
  the canonical evolving stream brief for managed parent issues

## Human And Agent Ownership In The Parent Issue

Human-owned:

- outcome, scope, priority, acceptance intent, constraints that require
  judgment, decisions, approvals, and freeform notes anywhere in the
  description

Agent-owned:

- direct description refreshes that improve structure, summarize current focus,
  and keep `Work Options` usable for backlog reruns
- later machine-maintained links or status summaries for child backlog state
- reply comments generated from `@io` trigger execution

Ownership rule:

- humans can edit anything, and agents should respond cooperatively by using the
  current description as source material for the next refresh
- agents may rewrite the parent description directly, but they should preserve
  useful intent and move the brief toward the shared template instead of
  treating any region as protected
- reply comments remain agent-owned status output
