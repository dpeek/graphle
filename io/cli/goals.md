# CLI Goals

## Objective

- Keep the command-line surface aligned with the typed `io.ts` config model and the current agent runtime.
- Make install, create, validation, and runtime entrypoints behave predictably across new and migrated repos.

## This Week

- Remove stale assumptions from CLI flows so agent commands consistently target the `io.ts` plus `io.md` repo shape.
- Keep `create` and install-oriented commands aligned with the shared loader contract in `lib`.
- Make command help and examples point users toward the current repo shape: `io.ts`, `io.md`, repo docs, and domain goals docs.

## Constraints

- CLI behavior should consume the shared config/runtime surface instead of re-implementing loader or routing rules.
- Unsupported legacy agent entrypoints should fail clearly instead of being treated as alternate defaults.
- User-facing commands need stable, reviewable semantics before new convenience layers are added.

## Proof Surfaces

- `../../src/cli/cli.ts`
- `../../src/cli/create.ts`
- `../../src/cli/install.ts`
- `../../src/cli/vscode.ts`
- `../../src/lib/config.ts`
- `../../src/config/index.ts`

## Related Docs

- `./overview.md`
- `../project/overview.md`
