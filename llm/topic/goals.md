# TUI Transcript Rendering

## Objective

- make agent transcripts easier to scan in the OpenTUI view without losing the underlying session-event model
- ship readable command, tool, and reasoning blocks that stay aligned between live, replayed, and retained sessions

## Current Focus

- render command and tool output as structured blocks instead of pipe-prefixed transcript noise
- surface Linear MCP writes and other high-signal tool results while filtering or demoting low-signal output
- show in-flight reasoning as a first-class transcript block with visible running vs completed state

## Constraints

- keep the primary implementation in `./tui`; only touch `./agent` when session-event mapping must stay in sync
- preserve the normalized session-event contract so `io agent tui`, attach, replay, and `io agent tail` continue to agree
- prove behavior with focused transcript, store, and TUI tests before widening formatting or filtering rules

## Proof Surfaces

- `./tui/src/transcript.ts`
- `./tui/src/codex-event-stream.ts`
- `./tui/src/store.ts`
- `./tui/src/tui.tsx`
- `./tui/src/tui.test.ts`
- `./agent/src/runner/codex.test.ts`
- `./io/topic/agent-opentui.md`

## Deferred

- broad visual redesign outside transcript readability
- per-tool rich renderers beyond the first Linear-focused formatting pass
- collapsing or hiding raw session data that operators may still need for debugging
