# TUI Overview

## Purpose

The agent-owned TUI renders the operator-facing session UI for IO runs on top of
the retained runtime and normalized event stream produced by `agent`.

## Docs

- `./overview.md`
- `./module-stream-workflow-plan.md`

## Layout

- `../../src/agent/tui/store.ts`: retained session state model
- `../../src/agent/tui/transcript.ts`: transcript shaping and formatting
- `../../src/agent/tui/tui.tsx`: UI composition
- `../../src/agent/tui/layout.ts`, `../../src/agent/tui/session-events.ts`, `../../src/agent/tui/codex-event-stream.ts`: rendering support
- `../../src/agent/tui/ui.test.ts`: UI/runtime regression coverage
