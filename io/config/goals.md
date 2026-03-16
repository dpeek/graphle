# Config Goals

## Objective

- Keep `@io/core/config` as the stable package boundary for importing the repo-root `io.ts` config from repo domains.
- Prove that the exported config shape, doc registry, and module metadata stay aligned with the live repo.

## This Week

- Keep the re-export package thin, but make its tests strict about the current context docs, module docs, and routing defaults.
- Catch stale path assumptions early when repo docs move.
- Preserve a clean import surface for packages that should not reach into the repo root with ad hoc relative paths.

## Constraints

- `@io/core/config` should stay boring: it re-exports the root config and validates that the boundary works.
- Path and registry assertions need to follow the actual repo layout rather than historical aliases.
- Any config-shape logic belongs in `lib`, not here.

## Proof Surfaces

- `../../src/config/index.ts`
- `../../src/config/index.test.ts`
- `../../io.ts`

## Related Docs

- `./overview.md`
- `../project/overview.md`
