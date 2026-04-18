Status: Proposed
Last Updated: 2026-04-18

# 01: Plate foundation

## Must Read

- `./spec.md`
- `../../AGENTS.md`
- `../../lib/graphle-web-ui/package.json`
- `../../lib/graphle-web-ui/src/markdown.tsx`
- `../../lib/graphle-web-ui/src/markdown.test.tsx`
- `../../lib/graphle-web-ui/src/markdown-code-info.ts`
- `../../lib/graphle-web-ui/src/global.css`
- `../../lib/graphle-web-ui/doc/browser-primitives.md`
- <https://platejs.org/docs/installation/manual>
- <https://platejs.org/docs/editor>
- <https://platejs.org/docs/controlled>
- <https://platejs.org/docs/markdown>

## Goal

Add the Plate dependency and conversion foundation inside
`@dpeek/graphle-web-ui` without replacing the production markdown renderer yet.

After this task, the package should have tested helpers that can deserialize
markdown strings into Plate values and serialize Plate values back to markdown.
`MarkdownRenderer` should still use the existing renderer until phase 2.

## Scope

Touch only:

- `lib/graphle-web-ui/package.json`
- `bun.lock`
- new internal `lib/graphle-web-ui/src/markdown-plate-*.ts[x]` files
- `lib/graphle-web-ui/src/markdown.test.tsx` or a new focused test file

Do not edit `graphle-module-core` or switch any user-facing component in this
phase.

## Tasks

- Add direct `@dpeek/graphle-web-ui` dependencies:
  - `platejs`
  - `@platejs/markdown`
  - `@platejs/basic-nodes`
  - `@platejs/code-block`
  - `@platejs/link`
  - `@platejs/list`
  - `@platejs/list-classic` only if task-list support needs it
  - `@platejs/table`
  - `@platejs/floating` only if needed by the planned toolbar imports
  - `lowlight`
  - `highlight.js` only if Lowlight language imports require it directly
- Keep `remark-gfm` as the GFM markdown conversion plugin.
- Create `markdown-plate-kit.ts` with a shared plugin factory. Start with the
  smallest plugin set needed for current markdown parity:
  - paragraphs
  - headings
  - blockquotes
  - horizontal rules
  - bold, italic, strikethrough, inline code
  - links
  - bulleted and numbered lists
  - task lists if supported cleanly
  - tables
  - code blocks, wired minimally for schema support but not yet styled
  - markdown conversion with `remarkGfm`
- Create `markdown-plate-value.ts` with pure helpers:
  - `deserializeMarkdownToPlateValue(markdown: string)`
  - `serializePlateValueToMarkdown(value: unknown)`
  - `normalizeMarkdownPlateValue(value: unknown)`
  - `emptyMarkdownPlateValue()`
- Keep the helpers independent from graph packages.
- Add tests that prove:
  - empty strings normalize to one empty paragraph
  - headings, paragraphs, bold, italic, strikethrough, inline code, links, and
    lists deserialize
  - GFM tables deserialize if the selected Plate plugins support them
  - task lists deserialize if the selected Plate plugins support them
  - supported values serialize back to markdown
  - raw HTML input is treated as text or dropped, not executed/rendered as HTML
- Do not assert exact full Plate object shapes unless necessary. Prefer stable
  semantic assertions over implementation-shaped snapshots.

## Rules

- Use `@platejs/*` packages, not old `@udecode/*` packages.
- Do not add Plate Plus, AI, comments, collaboration, slash menus, media, math,
  columns, or drag-and-drop plugins.
- Do not introduce ProseMirror, Tiptap, CodeMirror, or another editor.
- Do not remove `react-markdown`, `rehype-slug`, Shiki, or Monaco in this phase.
- Do not change `MarkdownRenderer` output in this phase.

## Verification

- Run `turbo check --filter=@dpeek/graphle-web-ui`.
- Run full `turbo check` if dependency changes affect more than the UI package.

## Success Criteria

- Plate dependencies are installed and locked.
- Shared Plate plugin/value helpers exist under `lib/graphle-web-ui/src/`.
- Conversion tests pass for the current markdown parity set.
- Existing `MarkdownRenderer` tests still pass unchanged or with only import
  organization changes.
- `MarkdownRenderer` still uses the old production renderer.

## Non-Goals

- replacing `MarkdownRenderer`
- adding `MarkdownEditor`
- changing markdown field editing
- replacing Shiki
- removing Monaco
