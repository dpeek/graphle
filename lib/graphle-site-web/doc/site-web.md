---
name: Graphle site web
description: "Assembled personal-site browser app, feature registration, and package-owned client assets for @dpeek/graphle-site-web."
last_updated: 2026-04-19
---

# Graphle Site Web

## Read This When

- you are changing the browser app served by `graphle dev`
- you are changing the site feature registration mounted in the generic shell
- you are changing the browser-safe graph client assembly for the local site
  graph
- you are changing package-built client assets, public route rendering, or
  inline authoring controls

## Current Contract

`@dpeek/graphle-site-web` builds the browser app that `@dpeek/graphle-local`
serves from package assets. The product path renders a site-owned frame, not
the generic Graphle shell chrome. It uses `@dpeek/graphle-web-ui` sidebar,
dialog, form, tooltip, button, and markdown primitives plus
browser-safe item helpers from `@dpeek/graphle-module-site`.
Markdown typography comes from `@dpeek/graphle-web-ui`'s shared
Tailwind Typography-backed renderer; site-web only adds route-level layout
constraints.

The package exports two browser/server-safe graph seams:

- `graphleSiteGraphNamespace`
- `graphleSiteGraphDefinitions`
- `graphleSiteGraphBootstrapOptions`
- `createGraphleSiteHttpGraphClient(...)`
- `createGraphlePublicSiteRuntime(...)`
- `createGraphlePublicSiteRuntimeFromBaseline(...)`
- `renderPublicSiteRoute(...)`

Those seams assemble `site:item`, `core:tag`, `core:color`, and the minimal
core definitions needed by the local site graph. The HTTP client wires them to
`@dpeek/graphle-client`'s standard `/api/sync` and `/api/tx` transport for
authenticated authoring. The public runtime hydrates a sanitized
`PublicSiteGraphBaseline` and validates its `projectionId` and `definitionHash`
against the installed site projection metadata before rendering.

The first screen is the current website route preview. The app loads:

- `GET /api/health`
- `GET /api/session`
- `GET /api/deploy/status` only after `/api/session` reports an authenticated
  local admin

Those payloads drive service and auth state. Public route content and the flat
item sidebar come from the embedded sanitized public graph baseline. That keeps
public hydration off `/api/sync` and away from private local-authoring facts.

The first screen is the current item route with one left sidebar and centered
content. Sidebar rows show only item icon and item title. For visitors,
path-backed items navigate to exact local routes with `history.pushState`;
URL-only items open their external URL in a new tab and do not create public
permalinks. For authenticated sessions, clicking any sidebar item selects the
item for editing instead. URL-only items therefore open the item editor rather
than navigating to the external URL. `popstate` reloads status and resolves the
route against the current graph runtime. URL-only items appear in the sidebar
but do not resolve as public pages.

Authenticated sessions always show the shared `EntitySurface` editor for the
selected item. Route-backed items use the current route item by default, and
URL-only items use the selected sidebar item. Edit mode keeps the same content
layout and mounts `EntitySurface` from `@dpeek/graphle-surface/react-dom` over
a live `site:item` entity ref, with the authored `siteItemSurface` section
chrome and field labels visible. Field selection, markdown editing,
tag/reference editing, enum selects, URL/date, boolean, number, and text
controls come from shared predicate metadata and
`@dpeek/graphle-module-core/react-dom`; site-web keeps only product chrome such
as the sidebar, route preview, delete action, and theme toggle. The browser app
does not ship package-local CSS overrides for predicate editors or display
rows; it imports the shared `@dpeek/graphle-web-ui/global.css` styles and uses
the default shared surface rendering wherever possible.

Route preview resolves the current item id back to a graph ref and renders
`siteItemViewSurface` through the lower-level entity-surface field section
pieces in view mode. That view surface preserves authored field order while
hiding visible field labels so public pages render as post content. Public
visitors use the sanitized public graph runtime. Authenticated sessions use the
private synced graph runtime and render the selected item through the authored
`siteItemSurface` editor.

There are no creation presets. The single `+` action creates a private
`Untitled` routed item through the graph runtime, flushes the transaction
through `/api/tx`, navigates to the new path, and enters edit mode.

Authenticated sessions can delete the current item from the item editor page
after a confirmation dialog. Navigation rows do not carry disclosure menus.
Drag-and-drop ordering uses `@dnd-kit/sortable` and writes normalized
consecutive `site:item.sortOrder` values as graph transactions.

Authenticated sessions also get a compact Cloudflare deploy panel in the
existing sidebar footer. It shows the last Worker URL, last deploy state,
whether the current public baseline matches the last deploy, missing account
ID/token controls, an optional Worker name control, progress while
`POST /api/deploy` is running, and sanitized errors. Visitors never load deploy
status and never see deploy controls. Site-web does not import the deploy
package or know Durable Object details; it only talks to local `/api/deploy/*`
endpoints.

The local theme helper reads and writes `localStorage.graphle.theme`, supports
`light`, `dark`, and `system`, applies `light`/`dark` classes to
`document.documentElement`, and updates when the system preference changes. The
visible control is one icon-only sidebar button with a tooltip and accessible
label.

Current visible mutation helpers call only the graph runtime. Create, delete,
reorder, and field edits produce typed graph mutations, and the runtime flushes
them through `/api/tx`. Browser authoring no longer calls `/api/site/items`,
`/api/site/items/order`, or `/api/site/items/:id`.

## Built Assets

`bun run build` emits server-side package modules under `out/` and browser
assets under `out/client/`. The local runtime imports the asset directory from
`@dpeek/graphle-site-web/assets` and serves those files directly. The default
`graphle dev` command doesn't run Vite in the user's current working directory.
Cloudflare Workers and other browser-only runtimes import shared public
rendering from `@dpeek/graphle-site-web/public-runtime` so they don't pull in
the Node-only asset path helper from the package root or browser-only authoring
controls. That subpath renders static public item markup from serialized item
views; the richer `siteItemViewSurface` route preview remains part of the
browser app.

## Boundary

This package may present site feature metadata, but it doesn't own the `site:`
schema. Schema stays in `@dpeek/graphle-module-site`; local route handling stays
in `@dpeek/graphle-local`.

The browser app does not import `@dpeek/graphle-app`, Better Auth providers,
query/workflow surfaces, Cloudflare SDK/API wiring, or user-project source
files.
