# Agent Overview

## Purpose

`agent` owns the issue-driven automation layer: workflow loading, issue routing, context assembly, worker scheduling, worktree lifecycle, retained runtime state, and the operator-facing session stream used by the TUI.

## Entry Points

- `../project/workflow.md`: primary user-facing contract for the preferred `Stream -> Feature -> Task` workflow
- `../project/backlog.md`: interactive stream backlog prompt and issue-structure contract
- `./module-stream-workflow-plan.md`: workflow loading, context assembly, routing, and module scoping
- `./tui-overview.md`: operator-facing terminal layout, transcript shaping, and live/replay display behavior
- `../../src/agent/service.ts`: supervisor scheduling and issue run orchestration
- `../../src/agent/workspace.ts`: branch lifecycle, task landing, and feature finalization

## Current Layout

- `../../src/agent/service.ts`: supervisor loop, task selection, and run orchestration
- `../../src/agent/workspace.ts`: control repo, stream/feature branches, issue worktrees, runtime files, and finalization
- `../../src/agent/workflow.ts`, `../../src/agent/context.ts`, `../../src/agent/issue-routing.ts`, `../../src/agent/builtins.ts`: workflow config, prompt docs, issue-linked doc resolution, routing, and built-in context
- `../../src/agent/runner/codex.ts`: Codex app-server process, approvals, session logging, and sandbox defaults
- `../../src/agent/tui-runtime.ts`: retained replay/attach bridge over runtime files and event logs
- `../../src/agent/tui/*`: session event schema, transcript shaping, layout, and interactive operator display surface
- `../../src/agent/tracker/linear.ts`: Linear candidate polling and state writes

## Current vs Roadmap

The preferred workflow is three levels: streams are maintained interactively,
features own integration-sized branches under a stream, and the supervisor
auto-runs released leaf tasks. Current code already gates task execution on the
right parent states, rebases and merges successful task work onto the feature
branch during the execution path, and reconciles `Done` features by squashing
them back onto the stream branch while preserving recoverable branch state on
conflicts. Supervisor-side follow-up after a task run is limited to cleanup and
stale-state reconciliation. `../project/workflow.md` remains the user-facing
contract for when humans choose to release a feature or stream.

## Future Work Suggestions

1. Add a short "start here by task" matrix for common jobs like stream backlog edits, task scheduling, or retained TUI debugging.
2. Add a compact API index for the exports in `../../src/agent/index.ts`.
3. Mark which docs describe durable contracts versus current repo proof surfaces.
4. Add explicit links from each focused doc to its most relevant tests.
5. Keep this page limited to navigation and move topic detail into the focused docs above.
