Status: Proposed
Last Updated: 2026-04-16

# PRD: Flat site item model

## Decision

The personal-site MVP should use one content type: `site:item`.

There should be no separate page type, post type, bookmark type, or link type.
There should also be no draft/published status. An item is either `private` or
`public`.

The UI should be a flat searchable sidebar of items. Items can be internal
pages, posts, external links, private bookmarks, public links, social links, or
annotated links. Those differences come from fields on the item, not from a
stored kind.

## Problem

The page/post split makes the MVP harder to use and harder to build.

For the user, it creates two authoring flows when the real action is always the
same: create an item, add optional text, add optional link metadata, tag it, and
decide whether it is public.

For the implementation, it creates duplicate route resolution, duplicate list
APIs, duplicate edit flows, and a deploy path that has to special-case pages and
posts. It also leaves no clean place for bookmarks and social links, even though
those are part of the first useful personal-site experience.

## Goals

- Make the first authoring UI one flat searchable list.
- Let the same item model represent pages, posts, links, bookmarks, socials,
  and annotated links.
- Let public visitors browse public items and open routed pages or external
  links.
- Let the local admin see and edit both private and public items.
- Use `core:tag` for tags instead of adding a site-specific tag type.
- Keep routing simple: only items with `path` get internal pages.
- Keep deploy simple: Cloudflare receives public items and the public tags they
  reference.

## Non-goals

- Separate page, post, bookmark, or social-link record types.
- A stored `kind` field.
- Draft/published status.
- Tag landing pages such as `/tags/graphle`.
- Custom icon upload or arbitrary SVG icons.
- Nested navigation, folders, collections, or multiple sidebars.
- Automatic link preview scraping.
- Comments from visitors.
- RSS, sitemap, search indexing, analytics, forms, or newsletter capture.

## Item model

`@dpeek/graphle-module-site` should define `site:item`.

Suggested fields:

- `title`: required string.
- `path`: optional site path. If present, it creates an internal page.
- `url`: optional absolute URL. If present, the item can link out.
- `body`: optional markdown.
- `excerpt`: optional string used in lists and previews.
- `visibility`: `private | public`.
- `icon`: optional named preset.
- `tags`: many references to `core:tag`.
- `pinned`: boolean.
- `sortOrder`: optional number.
- `publishedAt`: optional date.
- `createdAt`: date.
- `updatedAt`: date.

There is no `kind`. The browser may offer creation presets such as "Page",
"Post", "Link", or "Bookmark", but those presets only prefill fields. They do
not persist as item type data.

## Visibility

Visibility replaces status.

`private` means the item is visible only to the authenticated local admin.
Private is also the working state for unfinished writing.

`public` means the item is eligible for public local rendering and Cloudflare
deploy. A public item should have at least one useful public surface: a `path`,
a `url`, or both.

When an item changes from private to public, the system should set
`publishedAt` if it is empty. Turning an item private again should not erase
`publishedAt`; that value is part of the item history.

Cloudflare deploy should include only public items. It should also include only
tags referenced by public items.

## Routing

Only `path` creates an internal route.

- The home page is the item with `path === "/"`.
- `/about` resolves to the public item with `path === "/about"`.
- `/posts/example` is just another path, not a separate post route.
- An item with only `url` does not get a public page.
- An item with both `path` and `url` gets an internal page with an outbound link.

Paths must be unique across items when present. URLs do not need to be unique.

If a visitor opens the path for a private item, the public response is a normal
404. The local admin may preview private routed items while authenticated.

## Sidebar and search

The first screen should still be the usable site preview, but the main authoring
surface is a searchable item sidebar.

For local admins, the sidebar shows all items. Private items need a compact
private marker. Public visitors and the deployed site see only public items.

The sidebar should support one flat search box over:

- title
- path
- URL host/path
- excerpt
- body text
- tag key and tag name

Ordering should be deterministic:

1. pinned items first
2. lower `sortOrder` before higher `sortOrder`
3. newer `publishedAt` before older `publishedAt`
4. newer `updatedAt` before older `updatedAt`
5. title as the final tie-breaker

For an item with a `path`, selecting it should open the internal route. For an
item with only `url`, selecting it should open the external URL.

## Authoring

The editor should be the same for every item.

The local admin can:

- create an item
- edit title, path, URL, body, excerpt, visibility, icon, tags, pinned, and
  sort order
- create tags inline while editing an item
- mark an item public or private
- search all items from the sidebar
- open the public URL or internal path for an item

The UI may provide presets, but they should be field presets:

- Page: path and body.
- Post: `/posts/<slug>` path, body, excerpt, publishedAt.
- Link: URL, title, optional icon.
- Bookmark: URL, title, private visibility.
- Social link: URL, icon, pinned.

The stored graph still contains only `site:item`.

## Tags

Use `core:tag`.

The existing core tag type has a key and color, plus the inherited node fields
such as name and description. The site module should reference it rather than
creating `site:tag`.

The current minimal core boot path does not include `core:tag`. The
implementation should widen the minimal site boot set to include the core tag
type and its required scalar fields without pulling in saved queries, workflow,
identity, admission, share, capability, or installed-module records.

For the MVP, tags are filters and search facets only. Tags do not create public
routes.

## Icons

Use named icon presets on `site:item`.

The first preset set should cover common personal-site links:

- `link`
- `website`
- `github`
- `x`
- `linkedin`
- `rss`
- `email`
- `book`
- `note`

The implementation can add more presets when needed. Arbitrary uploaded icons,
SVG editing, and user-defined icon records are out of scope for this PRD.

## Public rendering

The local public renderer and the deployed Worker should use the same item
rules.

For public visitors:

- render only public items
- resolve internal pages by exact `path`
- expose URL-only public items in the sidebar/list
- show tags attached to public items
- hide private items and private-only tags

For authenticated local admins:

- show private and public items
- allow private routed item preview
- allow edits inline from the same site shell

## API impact

The Phase 4 API should be item-based instead of page/post based.

Replace page/post endpoints with a small item surface under `/api/*`:

- `GET /api/site/items`
- `POST /api/site/items`
- `PATCH /api/site/items/:id`
- `GET /api/site/route?path=<path>`

Route reads can stay separate because they serve public rendering and no-JS
fallbacks. Item list and mutation endpoints require local admin auth.

Unknown `/api/*` behavior should remain JSON 404.

## Deploy impact

Phase 5 deploy should publish the public item graph baseline.

The remote Worker should:

- store public `site:item` records
- store only `core:tag` records referenced by public items
- serve item routes by exact `path`
- render URL-only public items in the public sidebar/list
- return 404 for private or missing paths
- keep `/api/*` as the only API namespace

The remote Worker should not need page/post route branches.

## Acceptance criteria

- The site schema has one content type named `site:item`.
- There is no `site:page`, `site:post`, `site:status`, or stored item `kind` in
  the MVP site schema.
- The home page is a `site:item` with `path === "/"`.
- A URL-only item appears in the sidebar/list but has no public page.
- An item with both `path` and `url` renders an internal page with an outbound
  link.
- Private items are visible to the local admin and hidden from public visitors.
- Public items are visible locally and included in Cloudflare deploy.
- The authoring UI uses one editor for every item.
- The sidebar is flat and searchable.
- Tags use `core:tag`.
- Tags do not create tag pages in the MVP.
- Icons use named presets.
- Phase 4 and Phase 5 PDRs are updated before implementation to use this PRD as
  the source of truth.

## Documentation handoff

This PRD supersedes the page/post split in `./spec.md`,
`./phase-4-site-web.md`, and `./phase-5-cloudflare-deploy.md`.

Before implementation resumes:

- update the Phase 4 PDR to replace page/post schema, APIs, route helpers, and
  UI tasks with item-based equivalents
- update the Phase 5 PDR to publish public `site:item` records instead of page
  and post records
- update `@dpeek/graphle-module-site` docs when the schema changes
