Status: Proposed
Last Updated: 2026-04-18

# 06: Verification, docs, and cleanup

## Must Read

- `./spec.md`
- `./01-plate-foundation.md`
- `./02-read-only-renderer.md`
- `./03-code-blocks-lowlight.md`
- `./04-editor-field-integration.md`
- `./05-monaco-deletion-svg-fallback.md`
- `../../AGENTS.md`
- `../../lib/graphle-web-ui/README.md`
- `../../lib/graphle-web-ui/doc/browser-primitives.md`
- `../../lib/graphle-module-core/doc/react-dom.md`
- `../../lib/graphle-site-web/doc/site-web.md`
- `../../doc/index.md`

## Goal

Finish the Plate migration by removing stale docs, stale dependencies, and stale
tests, then verify the markdown authoring flow end to end.

After this task, the repo should describe and test one markdown stack:
Plate-backed view/edit rendering with Lowlight code highlighting and no Monaco.

## Scope

Touch docs, tests, package metadata, and small cleanup edits only. Do not start
new feature work in this phase.

## Tasks

- Search for stale references:
  - `monaco`
  - `Monaco`
  - `@dpeek/graphle-web-ui/monaco`
  - `sourcePreviewMonacoOptions`
  - `react-markdown`
  - `rehype-slug`
  - `shiki`
  - `markdown-shiki`
  - `data-web-markdown-renderer="react-markdown"`
  - write-only markdown controls
- Remove or update stale code, tests, docs, and package metadata found by that
  search.
- Confirm `@dpeek/graphle-web-ui/package.json` dependencies match the new stack:
  - Plate packages used directly are direct dependencies.
  - Lowlight/Highlight.js usage is declared directly.
  - removed packages are not still listed.
- Update docs:
  - `lib/graphle-web-ui/README.md`
  - `lib/graphle-web-ui/doc/browser-primitives.md`
  - `lib/graphle-module-core/doc/react-dom.md`
  - `lib/graphle-site-web/doc/site-web.md` if needed
  - `doc/index.md` if its package summary still names Monaco or the old
    markdown stack
- Update `pdr/plate-markdown-editor/spec.md` and phase files:
  - mark completed phases `Implemented`
  - add learnings from implementation
  - record any intentional markdown parity gaps
- Run package checks:
  - `turbo check --filter=@dpeek/graphle-web-ui`
  - `turbo check --filter=@dpeek/graphle-module-core`
  - `turbo check --filter=@dpeek/graphle-site-web`
- Run full `turbo check`.
- Perform a browser check using the site authoring surface:
  - open a markdown item in view mode
  - switch to edit mode
  - verify document layout does not jump
  - select text and verify the floating toolbar appears
  - toggle bold/italic/inline code and verify markdown saves
  - edit an existing code block and verify highlighting remains visible
  - verify a code block serializes back to fenced markdown
  - edit an SVG field and verify source editing plus preview still works
- Capture any browser-check limitation in this file if a local dev server or
  browser check cannot be run.

## Rules

- Do not leave stale docs that describe Monaco-backed markdown editing.
- Do not keep unused packages for possible future use.
- Do not add product-package markdown style overrides during cleanup.
- Do not expand the Plate plugin surface beyond the spec.
- Do not mark the spec implemented until full `turbo check` passes.

## Verification

- `turbo check --filter=@dpeek/graphle-web-ui`
- `turbo check --filter=@dpeek/graphle-module-core`
- `turbo check --filter=@dpeek/graphle-site-web`
- `turbo check`
- Browser check of markdown and SVG authoring, or a documented reason it could
  not run.

## Success Criteria

- No stale Monaco, Shiki, `react-markdown`, or `rehype-slug` implementation
  references remain outside historical PDR context.
- Docs describe Plate markdown rendering/editing and plain SVG source editing.
- Package dependencies match actual imports.
- Full `turbo check` passes.
- Browser verification confirms view/edit markdown parity and editable
  highlighted code blocks.
- `spec.md` and all phase files have accurate status.

## Non-Goals

- new toolbar controls
- new markdown feature support
- performance optimization beyond obvious dead-code/dependency cleanup
