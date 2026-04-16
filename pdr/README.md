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
- [Personal site layout and authoring UX](/Users/dpeek/code/graphle/pdr/personal-site-mvp/site-layout-ux.md):
  plan the minimalist site frame: item-only sidebar, centered route content,
  predicate-backed edit mode, one-button create, URL-only item actions,
  persisted drag ordering, and dark mode.
- [Personal site MVP phase 5](/Users/dpeek/code/graphle/pdr/personal-site-mvp/phase-5-cloudflare-deploy.md):
  plan Cloudflare deployment from the local shell: credential input, Worker and
  Durable Object provisioning, public `site:item` baseline publish, remote
  metadata, and deploy status/errors.
- [Dedicated auth routes](/Users/dpeek/code/graphle/pdr/dedicated-auth-routes.md):
  move inline auth into dedicated sign-in/sign-up routes with TanStack
  Router route guards and Better Auth-aligned session context.
- [Entity surface](/Users/dpeek/code/graphle/pdr/entity-surface.md): formalize the app-owned editable entity surface and define its relationship to `RecordSurfaceSpec`.
