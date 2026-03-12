# Agent Overview

## Purpose

`agent` owns issue routing, context assembly, worker orchestration, retained runtime state, and the operator-facing runtime consumed by the TUI.

## Docs

- `./goals.md`
- `./managed-stream-goals.md`
- `./managed-stream-backlog.md`
- `./managed-stream-comments.md`
- `./module-stream-workflow-plan.md`
- `../doc/stream-workflow.md`
- `../doc/context-defaults.md`

## Layout

- `../src/service.ts`, `../src/server.ts`, `../src/workspace.ts`: scheduling, worker lifecycle, retained state
- `../src/workflow.ts`, `../src/context.ts`, `../src/issue-routing.ts`, `../src/builtins.ts`: config, context, routing
- `../src/runner/`: Codex runner and event translation
- `../src/tui.ts`, `../src/tui-runtime.ts`, `../src/session-events.ts`: operator/runtime bridge
- `../src/tracker/`: tracker integrations
- `../src/*.test.ts`: package proof surfaces
