# Managed Stream Backlog Refresh

## Purpose

This document is the entry point for agents working on parent brief normalization, managed child payloads, or backlog rerun behavior.

## Current Parent Brief Shape

Backlog refreshes already normalize the managed parent description toward one shared shape:

- `Objective`
- `Current Focus`
- `Constraints`
- `Proof Surfaces`
- `Work Options`
- `Deferred`

Current behavior:

- the refresh rewrites the parent description directly instead of maintaining protected blocks
- useful human-authored sections such as decisions, approvals, risks, and notes are preserved when possible
- `Work Options` are the canonical input for rebuilding speculative child backlog
- repo-relative proof surfaces are preferred because they are useful for both humans and later agent reruns

## Current Child Payload

Managed child issues are currently execution-step issues with a stable description shape:

- `Outcome`
- `Scope`
- `Acceptance Criteria`
- `Module Scope`
- `Dependencies And Docs`
- `Out Of Scope`

Current child defaults:

- state starts at `Todo`
- priority inherits from the parent unless explicitly changed
- one primary module label is retained
- dependency ordering is expressed through `blockedBy`
- docs requested by the parent refresh or `@io backlog` are attached to the child payload

## Current Rerun Behavior

The current maintenance loop already distinguishes between durable work and speculative tail work:

- active, in-review, and done children are preserved
- untouched Todo children are the main rewrite surface
- matching existing Todo children are reused before creating new ones
- dependency edges are relinked when ordering changes
- the stream is usually topped back up to a short tail rather than replanned from scratch

This keeps reruns stable enough that backlog refreshes do not churn every child issue.

## Current Bootstrap And Release

- a successful managed backlog pass moves the parent to `In Review`
- new or refreshed child issues remain `Todo`
- the parent must move to `In Progress` before child execution can start
- child success moves only the child to `Done`

Backlog planning and child execution remain separate transitions even though they share one stream branch.

## Current Guardrails

- child issues should stay centered on one primary module surface
- cross-module work should be explicit in the child description rather than implied
- backlog refresh should avoid destructive rewrites of already active or completed children
- the agent should report created, reused, updated, and relinked backlog state clearly enough for operator review

## Roadmap

- tighten duplicate detection without making reruns opaque
- improve operator summaries of what changed across a refresh
- decide whether the target speculative tail length should become configurable
- clarify when cross-module exceptions deserve a new stream instead of a larger child

## Future Work Suggestions

1. Add one concrete before-and-after example of a parent brief refresh.
2. Document which child fields are intended to remain stable for downstream automation.
3. Add a short matrix for reuse versus update versus create decisions during reruns.
4. Clarify how explicit cross-module exceptions should be phrased.
5. Record which parts of the backlog summary are meant for humans versus future machine consumers.
