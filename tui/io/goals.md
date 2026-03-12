# TUI Goals

## Objective

- Make the operator surface the control room for IO runs, not just a terminal UI wrapper around worker output.
- Keep live, attach, replay, and plain-text follow mode aligned on the same retained runtime model.

## This Week

- Keep the readable transcript path compact and operator-first across supervisor and worker sessions.
- Improve retained-session reconstruction so attach and replay behave like first-class runtime views rather than best-effort log playback.
- Preserve the boundary between runtime production and rendering:
  the TUI should consume normalized session events, not parse ad hoc terminal text.

## Constraints

- The TUI is session-oriented, not file-oriented.
- Tail mode and the multi-column UI should stay aligned because they read the same retained event model.
- Runtime ownership stays in `agent`; `tui` is the rendering and interaction layer on top of that shared state.

## Proof Surfaces

- `../../agent/src/tui.ts`
- `../../agent/src/tui-runtime.ts`
- `../../agent/src/session-events.ts`
- `../src/store.ts`
- `../src/transcript.ts`
- `../src/tui.tsx`
- `../src/tui.test.ts`

## Related Docs

- `./overview.md`
- `../../agent/io/goals.md`
- `../../io/overview.md`
- `../../agent/doc/stream-workflow.md`
