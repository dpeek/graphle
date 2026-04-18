Status: Proposed
Last Updated: 2026-04-18

# 02: Plate read-only renderer

## Must Read

- `./spec.md`
- `./01-plate-foundation.md`
- `../../AGENTS.md`
- `../../lib/graphle-web-ui/src/markdown.tsx`
- `../../lib/graphle-web-ui/src/markdown-code-block.tsx`
- `../../lib/graphle-web-ui/src/markdown-code-info.ts`
- `../../lib/graphle-web-ui/src/markdown.test.tsx`
- `../../lib/graphle-web-ui/src/global.css`
- `../../lib/graphle-web-ui/doc/browser-primitives.md`
- `../../lib/graphle-site-web/src/site-app.test.tsx`
- <https://platejs.org/docs/static>
- <https://platejs.org/docs/markdown>

## Goal

Replace the public read-only markdown renderer with Plate while preserving the
current Graphle markdown style contract.

After this task, `MarkdownRenderer` should render a Plate document from a
markdown string, but markdown editing should still use the old Monaco path until
phase 4.

## Scope

Touch only:

- `lib/graphle-web-ui/src/markdown.tsx`
- new or existing Plate component mapping files
- `lib/graphle-web-ui/src/global.css`
- markdown renderer tests
- downstream tests that assert old renderer implementation details

Do not remove Shiki or Monaco in this phase.

## Tasks

- Rewrite `MarkdownRenderer` to:
  - deserialize `content` through the phase 1 helper
  - render with Plate read-only/static rendering
  - keep `className={cn("graph-markdown prose max-w-none dark:prose-invert", className)}`
  - expose a stable renderer marker such as `data-web-markdown-renderer="plate"`
- Add `markdown-plate-components.tsx` with components for:
  - paragraphs
  - headings
  - blockquotes
  - horizontal rules
  - links
  - bulleted lists
  - numbered lists
  - task lists if supported
  - tables
  - inline code
  - bold, italic, strikethrough marks
- Replace `rehype-slug` behavior:
  - add a heading ID decoration helper to `markdown-plate-value.ts`, or
  - compute IDs in heading components from document metadata
  - preserve duplicate heading suffix behavior
  - do not serialize heading IDs back into markdown
- Keep current `MarkdownCodeBlock` rendering for fenced code blocks if that is
  the least risky bridge before phase 3.
- Remove only the `react-markdown` renderer path from `markdown.tsx`.
- Update `markdown.test.tsx` to assert Plate-rendered output for:
  - headings with IDs
  - GFM tables
  - task lists
  - strikethrough
  - literal autolinks
  - inline code
  - fenced code block bridge output
  - caller class name merging
- Update downstream tests that check
  `data-web-markdown-renderer="react-markdown"`.

## Rules

- Keep all Graphle markdown styles scoped under `.graph-markdown`.
- Do not add product-package markdown overrides.
- Do not remove code-block copy behavior in read-only mode.
- Do not change markdown field edit mode yet.
- Do not remove `react-markdown` dependencies until phase 6 cleanup confirms no
  imports remain.

## Verification

- Run `turbo check --filter=@dpeek/graphle-web-ui`.
- Run `turbo check --filter=@dpeek/graphle-site-web` if site tests changed.
- Run full `turbo check` if renderer output changes affect multiple packages.

## Success Criteria

- `MarkdownRenderer` uses Plate for read-only rendering.
- `.graph-markdown prose max-w-none dark:prose-invert` remains the public class
  contract.
- Current markdown parity tests pass through Plate.
- Heading IDs still render deterministically.
- Code blocks still render visibly and copyably in read-only mode.
- Markdown editor behavior is unchanged.

## Non-Goals

- editable Plate markdown
- Lowlight code-block replacement
- Monaco deletion
- docs cleanup beyond changed renderer facts
