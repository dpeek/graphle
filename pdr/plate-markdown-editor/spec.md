Status: Proposed
Last Updated: 2026-04-18

# Plate markdown editor

## Must Read

- `../../AGENTS.md`
- `../../lib/graphle-web-ui/package.json`
- `../../lib/graphle-web-ui/src/markdown.tsx`
- `../../lib/graphle-web-ui/src/markdown-code-block.tsx`
- `../../lib/graphle-web-ui/src/markdown-code-info.ts`
- `../../lib/graphle-web-ui/src/markdown-shiki.ts`
- `../../lib/graphle-web-ui/src/markdown.test.tsx`
- `../../lib/graphle-web-ui/src/global.css`
- `../../lib/graphle-web-ui/src/monaco.tsx`
- `../../lib/graphle-web-ui/src/monaco.test.tsx`
- `../../lib/graphle-web-ui/src/source-preview.tsx`
- `../../lib/graphle-web-ui/doc/browser-primitives.md`
- `../../lib/graphle-web-ui/README.md`
- `../../lib/graphle-module-core/src/react-dom/fields/markdown.tsx`
- `../../lib/graphle-module-core/src/react-dom/fields/svg.tsx`
- `../../lib/graphle-module-core/src/react-dom/resolver.test.tsx`
- `../../lib/graphle-module-core/doc/react-dom.md`
- `../../lib/graphle-site-web/doc/site-web.md`
- `../../lib/graphle-site-web/src/site-app.test.tsx`
- <https://platejs.org/docs/installation/manual>
- <https://platejs.org/docs/editor>
- <https://platejs.org/docs/controlled>
- <https://platejs.org/docs/form>
- <https://platejs.org/docs/markdown>
- <https://platejs.org/docs/code-block>
- <https://platejs.org/docs/static>
- <https://platejs.org/docs/toolbar>
- <https://platejs.org/docs/api/floating>
- <https://platejs.org/docs/migration>

## Requirements

Replace the current markdown renderer and editor stack with Plate so a markdown
field has one document model in both view and edit mode.

The first shipped version must:

- keep the stored graph value as a markdown string
- replace `react-markdown` rendering with a Plate-backed markdown view
- replace the Monaco markdown source editor with a Plate rich text editor
- make edit mode look like the static document, with only the caret, selection,
  placeholder, and floating toolbar distinguishing edit mode
- keep the shared `.graph-markdown` typography contract and current visual
  style
- keep code block highlighting in read-only and edit mode
- stop shipping Monaco in `@dpeek/graphle-web-ui`
- keep product packages from adding local markdown CSS overrides
- update package docs to describe the new ownership boundary

Backwards compatibility is not a constraint. Existing markdown strings should be
best-effort deserialized into Plate, but old renderer implementation details,
old `data-web-markdown-renderer` values, Monaco source attributes, Shiki output,
and source/preview toggles may be deleted.

## Current State

`@dpeek/graphle-web-ui` currently owns markdown rendering:

- `MarkdownRenderer` in `lib/graphle-web-ui/src/markdown.tsx` is a client
  component.
- It uses `react-markdown`, `remark-gfm`, and `rehype-slug`.
- It renders `.graph-markdown prose max-w-none dark:prose-invert`.
- It routes fenced blocks through `MarkdownCodeBlock`.
- `MarkdownCodeBlock` lazy-loads `markdown-shiki.ts`, injects Shiki HTML, shows
  a compact header, and has a copy button.
- `markdown-code-info.ts` owns language aliasing, filename parsing, and
  no-highlight handling.
- `global.css` scopes Graphle markdown and code-block CSS under
  `.graph-markdown`.

`@dpeek/graphle-module-core/react-dom` currently owns the graph-aware field
integration:

- `MarkdownFieldView` renders `MarkdownRenderer`.
- `MarkdownFieldEditor` stores a local markdown string draft and writes through
  `performValidatedMutation(...)`.
- `MarkdownFieldEditor` mounts `MonacoSourceEditor` with markdown language mode.
- Resolver tests assert markdown controls are write-only source editors and do
  not render markdown in edit mode.

Monaco is not only used by markdown:

- `SvgFieldEditor` also imports `MonacoSourceEditor`.
- `@dpeek/graphle-web-ui` exports `./monaco`.
- `@monaco-editor/react` and `monaco-editor` are direct dependencies.

Removing Monaco therefore requires replacing the SVG source editor as well,
even though SVG is not part of the Plate markdown surface. The clean fallback is
a shared plain source text editor in `source-preview.tsx`.

## Plate Findings

Plate is not ProseMirror-based. Current Plate is built on Slate. The relevant
packages and docs use `platejs`, `platejs/react`, `platejs/static`, Slate values,
and Plate plugins.

Docs reviewed on 2026-04-18 show these implementation facts:

- `usePlateEditor` and `createPlateEditor` create Plate editors from plugin
  lists and initial values.
- The manual install path uses `platejs` and `@platejs/basic-nodes`.
- `@platejs/markdown` converts markdown strings to Plate values with
  `deserialize(...)` and Plate values back to markdown with `serialize(...)`.
- Markdown conversion uses remark plugins, including `remark-gfm`, rather than
  a rehype render pipeline.
- Migrating from `react-markdown` means moving customization from HTML tag
  renderers to `MarkdownPlugin` conversion rules and Plate node components.
- `@platejs/code-block` provides `CodeBlockPlugin`, `CodeLinePlugin`, and
  `CodeSyntaxPlugin`.
- Editable code block highlighting is configured with Lowlight, backed by
  Highlight.js languages.
- Plate provides static/read-only render paths, but the current Graphle
  renderer is already a client component because code blocks have copy controls.
  The first implementation can use a client read-only Plate view and keep a
  later `PlateStatic` extraction as a server-only optimization.
- Plate warns that fully controlling editor state can break selection/history.
  The markdown field should treat Plate as uncontrolled during normal typing
  and only reset the editor when the committed graph value changes externally.
- The Plate package rename is current: prefer `@platejs/*` imports. Some older
  docs and examples still show `@udecode/*`; do not add those packages.

Package versions checked with npm on 2026-04-18:

- `platejs`: `52.3.21`
- `@platejs/markdown`: `52.3.22`
- `@platejs/code-block`: `52.3.16`
- `@platejs/basic-nodes`: `52.3.10`
- `@platejs/list`: `52.3.10`
- `@platejs/list-classic`: `52.3.10`
- `@platejs/table`: `52.3.20`
- `@platejs/link`: `52.3.17`
- `@platejs/selection`: `52.3.10`
- `@platejs/autoformat`: `52.3.10`
- `@platejs/floating`: `52.3.10`
- `lowlight`: `3.3.0`
- `highlight.js`: `11.11.1`

Use compatible latest versions at implementation time rather than pinning these
numbers blindly.

## Architecture

### Public components

Keep the public markdown import stable:

- `@dpeek/graphle-web-ui/markdown`
- root re-export from `@dpeek/graphle-web-ui`

Replace the implementation behind that subpath with two public components:

- `MarkdownRenderer`: read-only Plate rendering for markdown strings
- `MarkdownEditor`: editable Plate rendering for markdown strings

Recommended signatures:

```ts
export function MarkdownRenderer(props: {
  className?: string;
  content: string;
}): ReactElement;

export function MarkdownEditor(props: {
  "aria-invalid"?: boolean;
  className?: string;
  onChange(nextMarkdown: string): void;
  placeholder?: string;
  value: string;
}): ReactElement;
```

`MarkdownRenderer` and `MarkdownEditor` must share the same plugin list,
component map, conversion helpers, and CSS classes. The editor should add an
editor-specific class only for caret/placeholder/selection behavior, not for a
different document skin.

### Internal module layout

Keep `src/markdown.tsx` as the public facade, then split implementation into
small internal files:

- `markdown-plate-kit.ts`: shared plugin factories and lowlight setup
- `markdown-plate-value.ts`: markdown string to Plate value, Plate value to
  markdown string, heading-id decoration, and empty-value normalization
- `markdown-plate-components.tsx`: paragraph, heading, link, list, table,
  inline code, and mark components mapped to Graphle styles
- `markdown-code-block-node.tsx`: Plate code block, code line, and syntax leaf
  components
- `markdown-floating-toolbar.tsx`: minimal floating toolbar
- `markdown-code-info.ts`: keep and extend current filename/language parsing
- `source-preview.tsx`: add a reusable plain text source editor for SVG and any
  future non-rich source controls

Delete after migration:

- `markdown-shiki.ts`
- Shiki-specific CSS variables and tests
- `monaco.tsx`
- `monaco.test.tsx`
- `@dpeek/graphle-web-ui/monaco` export

### Document value flow

The graph value remains a markdown string.

For view mode:

1. Deserialize the markdown string through `MarkdownPlugin`.
2. Normalize the resulting Plate value.
3. Render the value with the read-only Plate view.
4. Apply `.graph-markdown prose max-w-none dark:prose-invert`.

For edit mode:

1. Create the editor once from the committed markdown string.
2. Let Plate own selection, history, and incremental edits.
3. On document changes, serialize the Plate value back to markdown.
4. Call the existing field mutation path with the serialized markdown.
5. If validation fails, keep local editor content and set invalid chrome.
6. If the committed graph value changes externally, reset the Plate editor with
   a freshly deserialized value.

Do not pass a new `value` object on every render. Plate docs explicitly warn
that fully controlled replacements can break cursor position and undo history.

The first pass should keep the current mutation semantics and serialize on
change. If this is too expensive in practice, add a small debounce or switch to
`onBlur` in a later task after measuring, not as an initial behavior change.

### Plugin set

Use the smallest plugin set that preserves the current markdown renderer surface
and supports the requested editor:

- paragraphs, headings, blockquote, horizontal rule through
  `@platejs/basic-nodes`
- bold, italic, strikethrough, and inline code through `@platejs/basic-nodes`
- links through `@platejs/link`
- bulleted and numbered lists through `@platejs/list`
- task lists through `@platejs/list-classic` if Plate's current task-list
  plugin still lives there
- tables through `@platejs/table`, because the current renderer supports GFM
  tables
- code blocks through `@platejs/code-block`
- markdown conversion through `@platejs/markdown`
- `remark-gfm` for GFM conversion
- optional, narrow `@platejs/autoformat` rules for markdown shortcuts only
- `@platejs/floating` or the Plate floating toolbar registry code adapted into
  Graphle components

Do not add AI, comments, suggestions, block menu, drag and drop, columns, media,
mentions, slash command, table of contents, math, callouts, collaboration, or
Plate Plus features in this pass.

### Markdown conversion

Configure `MarkdownPlugin` rather than rendering markdown as HTML:

- `remarkPlugins: [remarkGfm]`
- no raw HTML processing
- no MDX in the first pass
- custom code-block rules only where needed to preserve language, filename, and
  metadata
- custom serialization rules only where needed to emit stable markdown strings

Preserve current renderer behavior where practical:

- GFM tables render in view mode.
- GFM task lists render as task list rows or readable list rows.
- GFM strikethrough round-trips.
- literal autolinks become links.
- headings keep deterministic IDs.
- inline code stays inline code.
- fenced code blocks preserve raw code, language, filename, and no-highlight
  intent.

`rehype-slug` will disappear with `react-markdown`. Replace it with a
Plate-value or component-level heading ID path:

- after markdown deserialization, walk top-level and nested headings in document
  order
- compute GitHub-style slug IDs with duplicate suffixes
- store IDs on heading nodes as non-semantic render metadata
- ensure serialization does not write those IDs back into markdown

### Code blocks

Switch code highlighting from Shiki HTML to Plate code-block nodes with
Lowlight:

- configure `CodeBlockPlugin` with a shared `lowlight` instance
- register only the languages Graphle currently supports instead of importing
  all languages
- keep current aliases in `markdown-code-info.ts`
- map current Shiki language names to Highlight.js/Lowlight names where they
  differ
- unknown languages render plain text and keep their visible label
- `text`, `plain`, `plaintext`, `txt`, and `nohighlight` disable highlighting
- code block contents remain editable in edit mode

Start with this language set:

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

If `mdx` or `jsonc` are awkward in Highlight.js, keep them readable as plain
code in the first pass and document the gap.

Keep the Graphle code-block chrome:

- compact header
- filename or language label
- scrollable body
- Graphle token colors and borders
- raw-code copy button in read-only mode
- optional copy button in edit mode if it does not disturb editing

Add a minimal language/filename affordance only if required for usability:

- existing fenced block language must be shown
- new code blocks may default to plain text
- changing language can be a compact select in the code-block header, not a
  large toolbar menu
- filename editing may be deferred if existing filenames render and round-trip

### Floating toolbar

Use a floating toolbar only. Do not add a fixed toolbar.

The toolbar should be small and icon-first, using existing Graphle button,
toggle, separator, dropdown/select, and tooltip primitives where possible.

Initial controls:

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

Do not put table controls, task-list controls, color controls, alignment,
comments, AI, slash commands, or block actions in the first toolbar. Tables and
task lists can still render and round-trip if already present.

The toolbar must hide in read-only mode and must not reserve layout space.

### Styling

The same document class remains the styling root:

```txt
graph-markdown prose max-w-none dark:prose-invert
```

Rules:

- do not override Graphle component styles unless required for Plate node
  integration
- do not add product-package markdown overrides
- style Plate-specific markup under `.graph-markdown`
- keep editor focus rings local to the editable root, not every block
- keep code block styles in the same visual family as the current
  `.graph-markdown-code-block`
- remove source-editor panel styling from markdown edit mode
- keep SVG source editing on the existing source-preview panel style

The user-facing edit view should be the document, not a card, textarea, source
panel, or preview toggle.

### Monaco removal

Remove Monaco from the package once markdown is on Plate.

Required cleanup:

- delete the `./monaco` package export
- delete `MonacoSourceEditor`
- remove `@monaco-editor/react` and `monaco-editor` from
  `lib/graphle-web-ui/package.json`
- update `bun.lock`
- update `lib/graphle-web-ui/README.md`
- update docs that describe Monaco-backed primitives
- replace `SvgFieldEditor` with a plain text source editor in
  `source-preview.tsx`

SVG should not use Plate. SVG source is code-like text, not a markdown document.
Use a textarea-backed source editor with the existing source-preview shell,
syntax highlighting deferred to a later code editor decision if needed.

## Rules

- Keep markdown view/edit primitives owned by `@dpeek/graphle-web-ui`.
- Keep graph-aware field mutation logic owned by
  `@dpeek/graphle-module-core/react-dom`.
- Keep the stored graph value as markdown text.
- Do not introduce ProseMirror, Tiptap, CodeMirror, or another editor stack.
- Do not keep Shiki only for read-only code blocks while using Lowlight in edit
  mode.
- Do not keep Monaco in `@dpeek/graphle-web-ui`.
- Do not add product-app markdown CSS overrides.
- Do not add a source/preview toggle for markdown edit mode.
- Do not add Plate plugins that are not needed for current markdown parity or
  the minimal toolbar.
- Do not enable raw HTML or MDX in markdown conversion in the first pass.
- Keep renderer and editor tests independent from browser-only APIs where
  possible.
- Keep docs current as part of the migration, not as follow-up work.

## Phases

Executable task files:

- [`01-plate-foundation.md`](./01-plate-foundation.md)
- [`02-read-only-renderer.md`](./02-read-only-renderer.md)
- [`03-code-blocks-lowlight.md`](./03-code-blocks-lowlight.md)
- [`04-editor-field-integration.md`](./04-editor-field-integration.md)
- [`05-monaco-deletion-svg-fallback.md`](./05-monaco-deletion-svg-fallback.md)
- [`06-verification-docs-cleanup.md`](./06-verification-docs-cleanup.md)

### 1. Plate foundation in web-ui

Goal: add the Plate dependencies and shared conversion/editor foundation without
yet replacing the field editor.

Tasks:

- Add direct dependencies to `@dpeek/graphle-web-ui`:
  - `platejs`
  - `@platejs/markdown`
  - `@platejs/basic-nodes`
  - `@platejs/code-block`
  - `@platejs/link`
  - `@platejs/list`
  - `@platejs/list-classic` if needed for GFM task lists
  - `@platejs/table`
  - `@platejs/floating` or the smallest package required by the chosen floating
    toolbar implementation
  - `@platejs/autoformat` only if markdown shortcut conversion is included
  - `lowlight`
  - needed `highlight.js/lib/languages/*` imports
- Create the shared markdown Plate plugin kit.
- Create markdown deserialize and serialize helpers.
- Add tests for:
  - empty markdown normalization
  - heading, paragraph, strong, emphasis, strike, inline code
  - GFM table/task-list deserialization where supported
  - serialization back to markdown
  - no raw HTML execution path
- Keep `MarkdownRenderer` on the old implementation until the new value path is
  proven by tests.

### 2. Plate read-only renderer

Goal: replace `react-markdown` with Plate rendering while preserving current
view output and styles.

Tasks:

- Rewrite `MarkdownRenderer` to render a read-only Plate document.
- Add Plate component mappings for headings, paragraphs, blockquotes, links,
  lists, tables, task-list rows, inline code, and marks.
- Replace `rehype-slug` behavior with heading ID decoration.
- Keep `.graph-markdown prose max-w-none dark:prose-invert` as the public
  renderer class contract.
- Port current `MarkdownRenderer` tests from `react-markdown` assertions to
  Plate-rendered output.
- Update downstream tests that assert renderer implementation attributes.
- Keep current code-block UI working in read-only mode until phase 3 replaces
  Shiki with Lowlight.

### 3. Editable code blocks and Lowlight

Goal: make code blocks render and edit through Plate with one highlighting
stack.

Tasks:

- Replace `markdown-shiki.ts` with a Lowlight setup owned by the Plate kit.
- Register the supported language set explicitly.
- Extend `markdown-code-info.ts` for any Highlight.js language-name differences.
- Add custom MarkdownPlugin code-block rules if default rules do not preserve
  Graphle filename/meta conventions.
- Implement `CodeBlockPlugin`, `CodeLinePlugin`, and `CodeSyntaxPlugin`
  components using the existing Graphle code-block chrome.
- Ensure read-only and edit mode use the same code block frame.
- Keep raw-code copy behavior in read-only mode.
- Add tests for:
  - language aliases
  - filename metadata
  - path-only fences
  - no-highlight aliases
  - unknown-language fallback
  - markdown serialization of edited code blocks
- Delete Shiki dependencies and Shiki CSS after parity is established.

### 4. Markdown editor and field integration

Goal: replace the Monaco markdown source editor with the Plate editor.

Tasks:

- Implement `MarkdownEditor` in `@dpeek/graphle-web-ui/markdown`.
- Add the minimal floating toolbar.
- Add placeholder and invalid-state styling that does not change the document
  skin.
- Replace `MarkdownFieldEditor` with `MarkdownEditor`.
- Preserve the existing validation and mutation callbacks.
- Reset the Plate editor only on external committed-value changes.
- Update `resolver.test.tsx` so markdown control rendering now asserts:
  - `data-web-field-kind="markdown"`
  - `graph-markdown`
  - no Monaco source editor
  - no preview toggle
  - editable Plate markup in control/field mode
- Update `lib/graphle-module-core/doc/react-dom.md` to remove the write-only
  source-editor rule and describe identical view/edit markdown rendering.

### 5. Monaco deletion and SVG source fallback

Goal: remove Monaco from the UI package completely.

Tasks:

- Add a textarea-backed source editor primitive to `source-preview.tsx`.
- Replace `SvgFieldEditor`'s `MonacoSourceEditor` usage with that source
  editor.
- Delete `monaco.tsx` and `monaco.test.tsx`.
- Remove `./monaco` from package exports.
- Remove `@monaco-editor/react` and `monaco-editor` dependencies.
- Update lockfile.
- Update source-preview tests for the new source editor attributes.
- Update docs and README references from Monaco to Plate/plain source editing.

### 6. Verification, docs, and cleanup

Goal: finish the migration and leave no stale renderer/editor stack behind.

Tasks:

- Update `lib/graphle-web-ui/doc/browser-primitives.md`.
- Update `lib/graphle-web-ui/README.md`.
- Update `lib/graphle-module-core/doc/react-dom.md`.
- Update `lib/graphle-site-web/doc/site-web.md` if its authoring description
  still implies source markdown editing.
- Search the repo for stale `monaco`, `react-markdown`, `rehype-slug`, `shiki`,
  and source-preview markdown references.
- Run package-focused checks while developing:
  - `turbo check --filter=@dpeek/graphle-web-ui`
  - `turbo check --filter=@dpeek/graphle-module-core`
  - `turbo check --filter=@dpeek/graphle-site-web`
- Run full `turbo check` before completion.
- Perform a browser check of the site authoring markdown field:
  - view mode and edit mode have matching document layout
  - floating toolbar appears on selection only
  - existing code blocks are highlighted in edit mode
  - code block edits serialize back to markdown
  - SVG source editing still works through the source-preview fallback

## Success Criteria

- `@dpeek/graphle-web-ui/markdown` exports a Plate-backed `MarkdownRenderer`
  and `MarkdownEditor`.
- Static markdown view and markdown edit mode share the same `.graph-markdown`
  styles.
- Edit mode is visually the same document, not a source panel.
- The toolbar is floating only and contains the minimal markdown controls.
- Markdown strings deserialize into Plate values and serialize back to markdown.
- The graph value for markdown fields remains a string.
- GFM tables, task lists, strikethrough, and autolinks render and serialize
  through the shared Plate markdown path. They do not need toolbar controls in
  the first pass.
- Heading IDs still render deterministically.
- Inline code remains inline.
- Fenced code blocks render in read-only and edit mode.
- Code highlighting uses Lowlight/Highlight.js through Plate code-block
  plugins.
- Shiki is removed from `@dpeek/graphle-web-ui`.
- Monaco is removed from `@dpeek/graphle-web-ui`.
- SVG source editing still has a usable textarea-backed editor.
- No product package adds markdown styling overrides.
- Docs no longer describe Monaco-backed markdown editing or write-only markdown
  controls.
- `turbo check` passes.

## Non-Goals

- raw HTML support in markdown
- MDX support
- Mermaid or executable diagram blocks
- AI editing
- comments or suggestions
- collaborative editing
- slash command menus
- block menus
- drag-and-drop blocks
- media embeds
- callouts, columns, math, mentions, table of contents, or Plate Plus features
- a full table editing toolbar
- source-mode markdown editing
- keeping Shiki as a second highlighter
- keeping Monaco for SVG or markdown

## Learnings

- Plate is Slate-based, so a ProseMirror replacement is not part of this
  migration.
- Plate code blocks use `@platejs/code-block` with Lowlight for editable syntax
  highlighting.
- The current renderer already centralized markdown styling under
  `@dpeek/graphle-web-ui`; the migration should preserve that ownership instead
  of moving markdown CSS into product packages.
- Removing Monaco is broader than markdown because SVG still uses the shared
  Monaco source editor.
- Plate's uncontrolled editor guidance fits the current field mutation path:
  keep Plate state internal, serialize on document changes, and reset only for
  external committed-value changes.
