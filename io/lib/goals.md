# Lib Goals

## Objective

- Keep `@io/core/lib` as the single source of truth for the typed config language, environment helpers, and shared loader behavior.
- Make `io.ts` authoring strict and ergonomic while preserving one loader contract for `agent`, `cli`, and `config`.

## This Week

- Tighten `defineIoConfig`, loader, and normalization behavior around the current repo contract instead of adding new ad hoc config paths.
- Keep provider and plugin shapes modular so future graph-backed inspection/editing can reuse the same metadata.
- Make path resolution, entrypoint preference, and context-doc handling explicit enough that downstream packages do not duplicate them.

## Constraints

- `lib` owns config semantics; repo domains should consume them rather than inventing parallel rules.
- The exported config stays config-like and serializable even when authored in TypeScript.
- Keep downstream loader expectations centered on the `io.ts` plus `io.md` repo contract.

## Proof Surfaces

- `../../src/lib/config.ts`
- `../../src/lib/env.ts`
- `../../src/lib/index.ts`
- `../../src/lib/config.test.ts`
- `../../src/lib/index.test.ts`
- `../../io.ts`

## Related Docs

- `./overview.md`
- `../project/overview.md`
