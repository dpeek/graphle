# Stream Workflow Goals

## Objective

- Make Linear the canonical source for stream context, feature planning, and
  task execution state.
- Use the three-level stream/feature/task model without comment-driven
  backlog automation.

## Current Focus

- Keep stream backlog editing interactive through `./backlog.md` and Codex.
- Allow parallel feature work inside a stream, while keeping task execution
  serialized within each feature.
- Only auto-run tasks when the stream and feature are `In Progress` and the
  task is `Todo`.
- Land successful task commits on the feature branch, and keep
  feature-to-stream squashing, rebasing, and merge as the target contract while
  the runtime finalization path is still being tightened.
- Keep repo docs terse and current while the stream issue holds the evolving
  roadmap, constraints, and references.

## Constraints

- Do not use comment-driven backlog workflows.
- Do not auto-mutate stream descriptions or child issues outside the interactive
  backlog session.
- Keep streams as long-lived branch roots, features as integration-sized branch
  owners, and tasks as single execution sessions.
- Do not auto-run tasks unless their feature and stream are both `In Progress`.
- Keep merge-conflict and sequencing decisions user-owned at the feature level.

## Proof Surfaces

- `../../io.ts`
- `./overview.md`
- `../agent/module-stream-workflow-plan.md`
- `../../src/agent/workspace.ts`
- `../../src/agent/types.ts`
- `../../src/agent/issue-routing.ts`
- `../../src/agent/service.ts`
- `../../src/agent/tracker/linear.ts`
- `../../src/agent/service.test.ts`
- `../../src/agent/workspace.ts`
- `../../src/agent/workspace.test.ts`

## Deferred

- Richer operator summaries around stream and feature finalization.
- Additional sequencing automation beyond the current feature/task state gates.
- Broader doc-layout cleanup outside the current routing, tracker, and
  scheduling slice.
