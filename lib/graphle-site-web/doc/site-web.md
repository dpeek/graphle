---
name: Graphle site web
description: "Assembled personal-site browser app, feature registration, and package-owned client assets for @dpeek/graphle-site-web."
last_updated: 2026-04-18
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
dropdown, dialog, form, tooltip, button, and markdown primitives plus
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

Those payloads drive service and auth state. Public route content and the flat
item sidebar come from the embedded sanitized public graph baseline. That keeps
public hydration off `/api/sync` and away from private local-authoring facts.

The first screen is the website preview with one left sidebar and centered
route content. Sidebar rows show only item icon and item title. Path-backed
items navigate to exact local routes with `history.pushState`; URL-only items
open their external URL in a new tab and do not create public permalinks.
`popstate` reloads status and resolves the route against the current graph
runtime. URL-only items appear in the sidebar but do not resolve as pages.

Authenticated sessions can edit either the current route item or a URL-only
item selected from the sidebar action menu. Edit mode keeps the same content
layout and mounts the shared `EntitySurface` from
`@dpeek/graphle-surface/react-dom` over a live `site:item` entity ref, with the
authored `siteItemSurface` section chrome and field labels visible. Field
selection, markdown editing, tag/reference editing, enum selects, URL/date,
boolean, number, and text controls come from shared predicate metadata and
`@dpeek/graphle-module-core/react-dom`; site-web keeps only product chrome such
as the sidebar, route preview, action menu, and theme toggle. The browser app
does not ship package-local CSS overrides for predicate editors or display
rows; it imports the shared `@dpeek/graphle-web-ui/global.css` styles and uses
the default shared surface rendering wherever possible.

Route preview resolves the current item id back to a graph ref and renders
`siteItemViewSurface` through the lower-level entity-surface field section
pieces in view mode. Public visitors use the sanitized public graph runtime.
Authenticated sessions use the private synced graph runtime and can switch the
selected item into the authored `siteItemSurface` editor.

There are no creation presets. The single `+` action creates a private
`Untitled` routed item through the graph runtime, flushes the transaction
through `/api/tx`, navigates to the new path, and enters edit mode.

Authenticated sessions can delete items through the sidebar action menu after a
confirmation dialog. Drag-and-drop ordering uses `@dnd-kit/sortable` and writes
normalized consecutive `site:item.sortOrder` values as graph transactions.

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

## Boundary

This package may present site feature metadata, but it doesn't own the `site:`
schema. Schema stays in `@dpeek/graphle-module-site`; local route handling stays
in `@dpeek/graphle-local`.

The browser app does not import `@dpeek/graphle-app`, Better Auth providers,
query/workflow surfaces, deploy wiring, or user-project source files.
