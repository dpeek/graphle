Status: Implemented
Last Updated: 2026-04-19

# 04: Markdown editor integration

## Must Read

- `./spec.md`
- `./01-plate-foundation.md`
- `./02-read-only-renderer.md`
- `./03-code-blocks-lowlight.md`
- `../../AGENTS.md`
- `../../lib/graphle-web-ui/src/markdown.tsx`
- `../../lib/graphle-web-ui/src/global.css`
- `../../lib/graphle-module-core/src/react-dom/fields/markdown.tsx`
- `../../lib/graphle-module-core/src/react-dom/resolver.test.tsx`
- `../../lib/graphle-module-core/doc/react-dom.md`
- `../../lib/graphle-site-web/doc/site-web.md`
- <https://platejs.org/docs/controlled>
- <https://platejs.org/docs/form>
- <https://platejs.org/docs/toolbar>
- <https://platejs.org/docs/api/floating>

## Goal

Replace the Monaco markdown source editor with a Plate markdown editor that
looks like the static document.

After this task, markdown field view and edit mode should share the same
document styling and Plate document model. Monaco may still exist temporarily
for SVG until phase 5.

## Scope

Touch:

- `lib/graphle-web-ui/src/markdown.tsx`
- `lib/graphle-web-ui/src/markdown-floating-toolbar.tsx`
- `lib/graphle-web-ui/src/markdown-plate-*.ts[x]`
- `lib/graphle-web-ui/src/global.css`
- `lib/graphle-web-ui/src/markdown.test.tsx`
- `lib/graphle-module-core/src/react-dom/fields/markdown.tsx`
- `lib/graphle-module-core/src/react-dom/resolver.test.tsx`
- `lib/graphle-module-core/doc/react-dom.md`
- `lib/graphle-site-web/doc/site-web.md` if its authoring text becomes stale

Do not remove Monaco package exports or SVG Monaco usage in this phase.

## Tasks

- Export `MarkdownEditor` from `@dpeek/graphle-web-ui/markdown` with this
  effective API:
  - `value: string`
  - `onChange(nextMarkdown: string): void`
  - optional `placeholder`
  - optional `className`
  - optional invalid state passthrough
- Create the Plate editor once from the committed markdown string.
- Let Plate own selection, history, and normal editing state.
- Serialize Plate value to markdown on document changes and call `onChange`.
- Reset the editor only when the committed `value` changes externally.
- Add placeholder styling that does not make the editor look like a textarea.
- Add invalid styling at the editor root without changing block-level document
  skin.
- Implement a floating toolbar only. Initial controls:
  - bold
  - italic
  - strikethrough
  - inline code
  - link
  - paragraph / heading 2 / heading 3 turn-into control
  - bulleted list
  - numbered list
  - blockquote
  - code block
- Use existing Graphle primitives for toolbar buttons, toggles, select/dropdown,
  separators, and tooltips where possible.
- Replace `MarkdownFieldEditor` so it renders `MarkdownEditor`.
- Preserve the existing mutation path:
  - `performValidatedMutation(...)`
  - `validatePredicateValue(...)`
  - `setPredicateValue(...)`
  - `useFieldMutationCallbacks(...)`
- Update resolver tests so markdown control rendering asserts:
  - `data-web-field-kind="markdown"`
  - `graph-markdown`
  - editable Plate markup
  - no Monaco markdown source attribute
  - no source/preview toggle
- Update docs that say markdown controls are write-only source editors.

## Rules

- Do not pass a fresh controlled Plate value on every render.
- Do not add a fixed toolbar.
- Do not add source-mode markdown editing.
- Do not add table controls, task-list controls, AI, comments, slash commands,
  or block menus.
- Do not override Graphle component styles except where Plate integration
  requires scoped `.graph-markdown` CSS.
- Keep graph mutation logic in `graphle-module-core/react-dom`, not web-ui.

## Verification

- Run `turbo check --filter=@dpeek/graphle-web-ui`.
- Run `turbo check --filter=@dpeek/graphle-module-core`.
- Run `turbo check --filter=@dpeek/graphle-site-web` if docs or tests there
  changed.
- If feasible, run a browser check of markdown edit mode in the site authoring
  surface:
  - view and edit have matching layout
  - floating toolbar appears only on selection/focus
  - code blocks remain highlighted while editable
  - edits persist as markdown strings

## Success Criteria

- `MarkdownEditor` exists and is exported.
- `MarkdownFieldEditor` no longer uses Monaco.
- Markdown edit mode looks like the rendered document.
- Floating toolbar contains only the minimal markdown controls.
- Existing validation and mutation behavior still works.
- Tests no longer assert write-only source editing for markdown.

## Non-Goals

- removing Monaco for SVG
- deleting Monaco package exports
- source markdown mode
- full table editing toolbar
- collaboration, comments, AI, media, or slash commands
