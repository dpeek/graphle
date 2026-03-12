# CLI Goals

## Objective

- Keep the command-line surface aligned with the typed `io.ts` config model and the current agent runtime.
- Make install, create, validation, and runtime entrypoints behave predictably across new and migrated repos.

## This Week

- Remove stale assumptions from CLI flows that still reflect the old `WORKFLOW.md` or `io.json`-first model.
- Keep `create` and install-oriented commands aligned with the shared loader contract in `lib`.
- Make command help and examples point users toward the current repo shape: `io.ts`, `io.md`, repo docs, and package-local goals docs.

## Constraints

- CLI behavior should consume the shared config/runtime surface instead of re-implementing loader or routing rules.
- Migration support still matters, but it should stay compatibility-only and clearly separated from the default path.
- User-facing commands need stable, reviewable semantics before new convenience layers are added.

## Proof Surfaces

- `../src/cli.ts`
- `../src/create.ts`
- `../src/install.ts`
- `../src/vscode.ts`
- `../../lib/src/config.ts`
- `../../config/src/index.ts`

## Related Docs

- `./overview.md`
- `../../lib/io/goals.md`
- `../../config/io/goals.md`
- `../../io/overview.md`
