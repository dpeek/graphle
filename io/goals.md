# IO Goals

## Objective

- Keep the repo-level IO contract legible: one root map, one current-goals doc,
  and package-local docs under `*/io`.
- Keep repo docs current and concise so agents can refresh them as code lands
  without carrying stale roadmap tone.

## This Week

- Finish the doc-layout migration to `./io` plus `./package/io`.
- Keep `io.ts`, context profiles, and package docs aligned with the live repo.
- Let Linear hold evolving stream/task planning while repo docs summarize the
  current state and proof surfaces.

## Constraints

- Root `io/` docs stay lightweight and current; deeper module detail lives in
  package-local docs.
- Repo docs should describe the current contract, not preserve historical design
  prose that quickly goes stale.
- Agents may refresh these docs as part of code changes, but the result should
  stay concise and directly useful in prompt context.

## Proof Surfaces

- `../io.ts`
- `../io.md`
- `../agent/src/context.ts`
- `../agent/src/workflow.ts`
- `../config/src/index.test.ts`

## Related Docs

- `./overview.md`
- `../agent/io/overview.md`
- `../graph/io/overview.md`
- `../cli/io/overview.md`
- `../lib/io/overview.md`
