# Plans

- [Personal site MVP](/Users/dpeek/code/graphle/pdr/personal-site-mvp/spec.md):
  ship the first end-to-end Graphle product slice with `bunx @dpeek/graphle dev`,
  cwd-local `graphle.sqlite`, a reusable shell, a site module, Cloudflare deploy,
  and local/remote graph sync.
- [Personal site MVP site item PRD](/Users/dpeek/code/graphle/pdr/personal-site-mvp/site-item-prd.md):
  define the flat `site:item` product model for pages, posts, links,
  bookmarks, socials, visibility, tags, icons, sidebar search, and deploy.
- [Personal site MVP phase 1](/Users/dpeek/code/graphle/pdr/personal-site-mvp/phase-1-local-dev.md):
  implemented the local `graphle dev` spine with `.env`, `graphle.sqlite`, a Bun
  server, `/api/init`, signed local admin cookies, placeholder site rendering,
  and focused tests.
- [Personal site MVP phase 2](/Users/dpeek/code/graphle/pdr/personal-site-mvp/phase-2-site-graph.md):
  implemented the minimal core and durable site graph substrate: `site:` schema,
  SQLite persisted-authority storage, first-run seed content, and local runtime
  graph bootstrap.
- [Personal site MVP phase 3](/Users/dpeek/code/graphle/pdr/personal-site-mvp/phase-3-shell.md):
  implemented the lightweight browser shell substrate: canonical web UI
  primitives, generic shell runtime, assembled site browser app, and local
  packaged asset serving with the graph-backed fallback kept in place.
- [Personal site MVP phase 4](/Users/dpeek/code/graphle/pdr/personal-site-mvp/phase-4-site-web.md):
  implemented inline site authoring and preview with the flat `site:item` model:
  graph-backed item routes, local item APIs, markdown editing, private/public
  visibility, tags, icon presets, and a searchable item sidebar.
- [Personal site MVP phase 4 graph surface reset](/Users/dpeek/code/graphle/pdr/personal-site-mvp/phase-4-graph-surface-reset/spec.md):
  plan the corrective productization pass that deletes custom site content DTO
  authoring, extracts app-proven entity surface integration into shared
  packages, and rewires `site-web` to schema/surface-driven graph authoring.
- [Personal site MVP phase 4 graph transport reset](/Users/dpeek/code/graphle/pdr/personal-site-mvp/phase-4-graph-surface-reset/01-generic-local-graph-transport.md):
  implemented the first reset slice: authenticated `/api/sync` and `/api/tx`
  over the existing persisted local site authority, plus the browser-safe
  site graph client seam needed before custom site DTO APIs are deleted.
- [Personal site MVP phase 4 entity surface reset](/Users/dpeek/code/graphle/pdr/personal-site-mvp/phase-4-graph-surface-reset/02-productize-entity-surfaces.md):
  plan the second reset slice: move reusable entity view/edit/create surface
  integration out of `graphle-app`, into shared surface packages, and delete or
  thin app-local generic copies.
- [Personal site MVP phase 4 site-web reset](/Users/dpeek/code/graphle/pdr/personal-site-mvp/phase-4-graph-surface-reset/03-site-web-migration-and-deletion.md):
  plan the final reset slice: add `site:item` surface metadata, migrate
  `site-web` to graph transport and shared entity surfaces, then delete custom
  site content DTO authoring.
- [Personal site MVP public graph projection](/Users/dpeek/code/graphle/pdr/personal-site-mvp/public-graph-projection.md):
  implemented the pre-deploy cleanup that replaces the unauthenticated route DTO
  fallback with a sanitized public graph runtime, using the existing projection
  contracts instead of a new DTO-shaped model.
- [Personal site MVP cloud public rendering](/Users/dpeek/code/graphle/pdr/personal-site-mvp/cloud-public-rendering.md):
  implemented the deployed public-site renderer package: Cloudflare Worker SSR
  from the public graph baseline, projection-compatible baseline metadata,
  Durable Object storage, CDN caching, and a clean deploy/sync handoff.
- [Personal site layout and authoring UX](/Users/dpeek/code/graphle/pdr/personal-site-mvp/site-layout-ux.md):
  plan the minimalist site frame: item-only sidebar, centered route content,
  predicate-backed edit mode, one-button create, URL-only item actions,
  persisted drag ordering, and dark mode.
- [Personal site MVP phase 5](/Users/dpeek/code/graphle/pdr/personal-site-mvp/phase-5-cloudflare-deploy.md):
  implemented Cloudflare deployment from the local shell: credential input,
  Worker and Durable Object provisioning, public `site:item` baseline publish,
  graph-backed remote metadata, and deploy status/errors.
- [Dedicated auth routes](/Users/dpeek/code/graphle/pdr/dedicated-auth-routes.md):
  move inline auth into dedicated sign-in/sign-up routes with TanStack
  Router route guards and Better Auth-aligned session context.
- [Entity surface](/Users/dpeek/code/graphle/pdr/entity-surface.md): formalize the app-owned editable entity surface and define its relationship to `RecordSurfaceSpec`.
- [Markdown code blocks](/Users/dpeek/code/graphle/pdr/markdown-code-blocks.md):
  add lazy Shiki highlighting, copy-to-clipboard controls, and
  filename/language detection to the shared markdown renderer.
- [Plate markdown editor](/Users/dpeek/code/graphle/pdr/plate-markdown-editor/spec.md):
  replace the markdown renderer and editor stack with Plate, share view/edit
  document styling, support editable highlighted code blocks, and remove Monaco.
- [Plate markdown editor phase 1](/Users/dpeek/code/graphle/pdr/plate-markdown-editor/01-plate-foundation.md):
  add Plate dependencies and tested markdown conversion helpers without
  changing the production renderer.
- [Plate markdown editor phase 2](/Users/dpeek/code/graphle/pdr/plate-markdown-editor/02-read-only-renderer.md):
  switch the read-only markdown renderer to Plate while preserving shared
  markdown styles.
- [Plate markdown editor phase 3](/Users/dpeek/code/graphle/pdr/plate-markdown-editor/03-code-blocks-lowlight.md):
  move code blocks to Plate and Lowlight so highlighting works in editable
  documents.
- [Plate markdown editor phase 4](/Users/dpeek/code/graphle/pdr/plate-markdown-editor/04-editor-field-integration.md):
  add the Plate markdown editor, floating toolbar, and graph field integration.
- [Plate markdown editor phase 5](/Users/dpeek/code/graphle/pdr/plate-markdown-editor/05-monaco-deletion-svg-fallback.md):
  remove Monaco and replace SVG editing with the plain source editor fallback.
- [Plate markdown editor phase 6](/Users/dpeek/code/graphle/pdr/plate-markdown-editor/06-verification-docs-cleanup.md):
  clean stale docs and dependencies, run full checks, and verify browser
  authoring behavior.
