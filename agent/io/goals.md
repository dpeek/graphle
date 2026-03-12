# Agent Goals

## Objective

- Keep the agent runtime legible while it turns parent issues into planned and shipped stream work.
- Improve context quality so backlog and execution runs use the right repo docs, routing rules, and stream contracts by default.

## This Week

- Make supervisor and worker output easier to trust:
  clearer lifecycle lines, clearer block reasons, and less transcript noise across stdout, retain/replay, and the TUI.
- Finish the managed-stream loop in one coherent contract:
  parent validation, managed backlog refresh, `@io` comment handling, and stable reply/writeback surfaces.
- Tighten context assembly around `io.ts`, module docs, and issue routing so planning runs stay explicit and debuggable.

## Constraints

- The runtime stays event-first: `AgentService` owns scheduling, the Codex runner emits typed session events, and operator surfaces consume that shared stream.
- Managed-stream automation may only rewrite managed markers or agent-owned replies; human-authored issue prose stays outside that boundary.
- Throughput matters, but not at the cost of operator visibility or stream-state clarity.

## Proof Surfaces

- `../src/service.ts`
- `../src/workspace.ts`
- `../src/server.ts`
- `../src/runner/codex.ts`
- `../src/session-events.ts`
- `../src/workflow.ts`
- `../src/issue-routing.ts`
- `../src/builtins.ts`
- `../src/backlog-proposal.ts`
- `../src/managed-comments.ts`
- `../doc/stream-workflow.md`

## Related Docs

- `./overview.md`
- `./managed-stream-goals.md`
- `./managed-stream-backlog.md`
- `./managed-stream-comments.md`
- `./module-stream-workflow-plan.md`
- `../../io/overview.md`
- `../../tui/io/goals.md`
