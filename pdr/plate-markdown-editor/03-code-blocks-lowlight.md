Status: Proposed
Last Updated: 2026-04-18

# 03: Code blocks and Lowlight

## Must Read

- `./spec.md`
- `./01-plate-foundation.md`
- `./02-read-only-renderer.md`
- `../../AGENTS.md`
- `../../lib/graphle-web-ui/src/markdown-code-block.tsx`
- `../../lib/graphle-web-ui/src/markdown-code-info.ts`
- `../../lib/graphle-web-ui/src/markdown-shiki.ts`
- `../../lib/graphle-web-ui/src/markdown.test.tsx`
- `../../lib/graphle-web-ui/src/global.css`
- <https://platejs.org/docs/code-block>

## Goal

Move code blocks onto Plate's code-block plugins and Lowlight so code blocks can
be highlighted in both read-only and edit mode.

After this task, `@dpeek/graphle-web-ui` should no longer need Shiki for
markdown code blocks.

## Scope

Touch only:

- `lib/graphle-web-ui/src/markdown-plate-kit.ts`
- `lib/graphle-web-ui/src/markdown-code-info.ts`
- `lib/graphle-web-ui/src/markdown-code-block*.tsx`
- `lib/graphle-web-ui/src/markdown-plate-components.tsx`
- `lib/graphle-web-ui/src/markdown-plate-value.ts`
- `lib/graphle-web-ui/src/markdown.test.tsx`
- `lib/graphle-web-ui/src/global.css`
- `lib/graphle-web-ui/package.json`
- `bun.lock`

Do not change `MarkdownFieldEditor` yet.

## Tasks

- Configure `CodeBlockPlugin`, `CodeLinePlugin`, and `CodeSyntaxPlugin` in the
  shared Plate plugin kit.
- Create a shared Lowlight instance and register only Graphle-supported
  languages:
  - `bash`
  - `css`
  - `diff`
  - `html` / `xml`
  - `javascript`
  - `json`
  - `jsonc`, if supported cleanly
  - `jsx`
  - `markdown`
  - `mdx`, if supported cleanly
  - `scss`
  - `sql`
  - `tsx`
  - `typescript`
  - `yaml`
- Extend `markdown-code-info.ts` so the current alias, filename, path-only, and
  no-highlight conventions map to Lowlight/Highlight.js names.
- Add custom markdown conversion rules if Plate defaults do not preserve:
  - fence language
  - `filename=`, `file=`, `name=`, or `title=` metadata
  - path-only fences
  - no-highlight aliases
- Build `markdown-code-block-node.tsx` components that preserve the Graphle
  code-block chrome:
  - compact header
  - language or filename label
  - scrollable body
  - Graphle borders/background/token colors
  - raw-code copy button in read-only mode
  - no copy button in edit mode unless it does not disturb editing
- Replace Shiki-specific CSS selectors and variables with Lowlight/Plate syntax
  leaf styling under `.graph-markdown`.
- Delete `markdown-shiki.ts`.
- Remove Shiki dependencies from `@dpeek/graphle-web-ui/package.json` if no
  imports remain.
- Update tests for:
  - supported language highlighting
  - unknown-language fallback
  - no-highlight aliases
  - filename metadata
  - path-only fences
  - markdown serialization of code blocks
  - read-only copy button presence

## Rules

- Do not keep Shiki as a second read-only highlighter.
- Unknown languages must never throw.
- Raw source text remains the copied value.
- `text`, `plain`, `plaintext`, `txt`, and `nohighlight` must disable
  highlighting.
- If `mdx` or `jsonc` are not cleanly supported by Highlight.js, render them as
  plain code and document that in tests or comments.
- Keep code-block CSS inside `.graph-markdown`.

## Verification

- Run `turbo check --filter=@dpeek/graphle-web-ui`.
- Run full `turbo check` if package dependency cleanup changes the lockfile.

## Success Criteria

- Plate renders code blocks through `@platejs/code-block`.
- Lowlight highlights supported languages.
- Existing filename/language conventions still parse and serialize.
- Shiki files, imports, CSS, tests, and dependencies are gone from
  `@dpeek/graphle-web-ui`.
- Read-only code blocks still have Graphle chrome and copy controls.

## Non-Goals

- markdown editor integration
- code-block language picker
- filename editing UI
- line numbers or line highlighting
- Mermaid or executable diagrams
