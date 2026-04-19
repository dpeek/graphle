# Graphle Site Web

`@dpeek/graphle-site-web` assembles the personal-site browser app from
browser primitives and the MVP site item contracts.

## Package Docs

- [`./doc/site-web.md`](./doc/site-web.md): app assembly, route loading, inline
  authoring, built assets, and current non-goals.

## What It Owns

- the package-built browser entrypoint served by `@dpeek/graphle-local`
- the browser-safe local site graph namespace and `createHttpGraphClient`
  assembly seam used for authenticated authoring through `/api/sync` and
  `/api/tx`
- the public site graph runtime and `renderPublicSiteRoute(...)` entrypoint
  used to render sanitized public graph baselines, exported through
  `@dpeek/graphle-site-web/public-runtime` for Worker-safe consumers
- the site-owned sidebar and centered content frame for the personal-site path
- personal-site feature registration for future generic-shell composition
- local status loading from `/api/health` and `/api/session`
- a flat item sidebar with visitor path navigation, visitor URL-only external
  links, authenticated item selection, drag reorder, and a theme toggle
- one inline shared entity-surface `site:item` editor with page-level delete
  confirmation for authenticated local admin sessions
- graph-backed browser route preview through the authored view surface, plus a
  static Worker-safe public renderer for Cloudflare deployment

## What It Does Not Own

- `site:` schema definitions, local API route handling, SQLite storage, deploy,
  or sync protocol ownership
- Better Auth, `@dpeek/graphle-app`, or user-project source scaffolding

## Validation

Run `turbo check --filter=@dpeek/graphle-site-web` from the repo root, or
`bun run check` in this package.
