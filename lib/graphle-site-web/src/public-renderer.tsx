import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

import type { GraphlePublicSiteRuntime } from "./graph.js";
import {
  findGraphleSiteItemView,
  listGraphleSiteItemViews,
  resolveGraphleSiteRoute,
  type GraphleSiteRoute,
  type GraphleSiteItemView,
} from "./site-items.js";
import type { GraphleSiteHealth, GraphleSiteSession } from "./status.js";

export interface PublicSiteRenderAssets {
  readonly scripts?: readonly string[];
  readonly styles?: readonly string[];
}

export interface RenderPublicSiteRouteOptions {
  readonly runtime: GraphlePublicSiteRuntime;
  readonly path: string;
  readonly assets?: PublicSiteRenderAssets;
  readonly health?: GraphleSiteHealth;
  readonly session?: GraphleSiteSession;
  readonly now?: () => Date;
}

export interface RenderedPublicSiteRoute {
  readonly html: string;
  readonly items: readonly GraphleSiteItemView[];
  readonly route: GraphleSiteRoute;
  readonly status: number;
  readonly title: string;
}

function routeTitle(route: GraphleSiteRoute, runtime: GraphlePublicSiteRuntime): string {
  if (route.kind !== "item") return "Page not found";
  return findGraphleSiteItemView(runtime, route.itemId)?.title ?? "Page not found";
}

const publicSiteDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

function formatPublicSiteDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : publicSiteDateFormatter.format(date);
}

function safeHref(value: string): string | undefined {
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function renderInlineMarkdown(value: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value))) {
    if (match.index > lastIndex) parts.push(value.slice(lastIndex, match.index));

    const token = match[0];
    const key = `${keyPrefix}:${match.index}`;
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={key}>{renderInlineMarkdown(token.slice(2, -2), key)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(<em key={key}>{renderInlineMarkdown(token.slice(1, -1), key)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const href = link ? safeHref(link[2] ?? "") : undefined;
      parts.push(
        href ? (
          <a key={key} href={href}>
            {renderInlineMarkdown(link?.[1] ?? "", key)}
          </a>
        ) : (
          (link?.[1] ?? token)
        ),
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < value.length) parts.push(value.slice(lastIndex));
  return parts;
}

function renderMarkdownLine(value: string, keyPrefix: string): ReactNode {
  return renderInlineMarkdown(value, keyPrefix);
}

function renderMarkdownBlock(block: string, blockIndex: number): ReactNode {
  const lines = block.split("\n");
  const firstLine = lines[0] ?? "";
  const heading = /^(#{1,3})\s+(.+)$/.exec(firstLine);
  const key = `block:${blockIndex}`;

  if (heading) {
    const level = heading[1]?.length ?? 1;
    const content = renderMarkdownLine(heading[2] ?? "", key);
    if (level === 1) return <h1 key={key}>{content}</h1>;
    if (level === 2) return <h2 key={key}>{content}</h2>;
    return <h3 key={key}>{content}</h3>;
  }

  if (lines.every((line) => /^-\s+/.test(line))) {
    return (
      <ul key={key}>
        {lines.map((line, index) => (
          <li key={`${key}:li:${index}`}>{renderMarkdownLine(line.replace(/^-\s+/, ""), key)}</li>
        ))}
      </ul>
    );
  }

  return (
    <p key={key}>
      {lines.flatMap((line, index) => [
        ...(index === 0 ? [] : [<br key={`${key}:br:${index}`} />]),
        ...renderInlineMarkdown(line, `${key}:line:${index}`),
      ])}
    </p>
  );
}

function MarkdownBody({ value }: { readonly value: string }) {
  const blocks = value
    .replaceAll("\r\n", "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  return <>{blocks.map(renderMarkdownBlock)}</>;
}

function PublicRouteView({
  item,
  route,
}: {
  readonly item?: GraphleSiteItemView;
  readonly route: GraphleSiteRoute;
}) {
  if (route.kind !== "item") {
    return (
      <article className="flex flex-col gap-4" data-route-kind="not-found">
        <h1>Page not found</h1>
        <p className="text-muted-foreground">{route.message}</p>
      </article>
    );
  }

  if (!item) {
    return (
      <article className="flex flex-col gap-4" data-route-kind="not-found">
        <h1>Page not found</h1>
        <p className="text-muted-foreground">No visible item exists at {route.path}.</p>
      </article>
    );
  }

  return (
    <article
      className="flex flex-col gap-4"
      data-graphle-public-item={item.id}
      data-route-kind="item"
    >
      <header className="flex flex-col gap-2">
        <h1>{item.title}</h1>
        <p className="text-sm text-muted-foreground">{formatPublicSiteDate(item.createdAt)}</p>
        {item.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Tags">
            {item.tags.map((tag) => (
              <li
                key={tag.id}
                className="rounded-sm border px-2 py-1 text-xs"
                style={{ borderColor: tag.color }}
              >
                {tag.name}
              </li>
            ))}
          </ul>
        ) : null}
      </header>
      {item.body ? (
        <div className="flex flex-col gap-4" data-graphle-public-body="">
          <MarkdownBody value={item.body} />
        </div>
      ) : null}
      {item.url && !item.body ? (
        <p>
          <a href={safeHref(item.url) ?? undefined}>{item.url}</a>
        </p>
      ) : null}
    </article>
  );
}

function PublicSiteShell({
  items,
  route,
  title,
}: {
  readonly items: readonly GraphleSiteItemView[];
  readonly route: GraphleSiteRoute;
  readonly title: string;
}) {
  const routeItem =
    route.kind === "item" ? items.find((candidate) => candidate.id === route.itemId) : undefined;

  return (
    <div className="min-h-svh bg-background text-foreground" data-graphle-public-preview="">
      <aside className="border-border bg-sidebar text-sidebar-foreground md:fixed md:inset-y-0 md:left-0 md:w-60 md:border-r">
        <nav className="flex flex-col gap-1 p-4" aria-label="Site">
          <a className="mb-4 font-semibold" href="/">
            {title}
          </a>
          {items.map((item) =>
            item.path ? (
              <a
                key={item.id}
                aria-current={
                  route.kind === "item" && route.itemId === item.id ? "page" : undefined
                }
                className="rounded-sm px-2 py-1"
                href={item.path}
              >
                {item.title}
              </a>
            ) : item.url ? (
              <a
                key={item.id}
                className="rounded-sm px-2 py-1"
                href={safeHref(item.url) ?? undefined}
                rel="noreferrer"
                target="_blank"
              >
                {item.title}
              </a>
            ) : null,
          )}
        </nav>
      </aside>
      <main className="mx-auto block min-h-0 w-full max-w-[52rem] px-5 py-8 md:min-h-svh md:px-[clamp(1.25rem,4vw,3.5rem)] md:py-[clamp(2rem,6vw,5rem)] md:pl-[17rem]">
        <PublicRouteView item={routeItem} route={route} />
      </main>
    </div>
  );
}

export function renderPublicSiteRoute({
  runtime,
  path,
}: RenderPublicSiteRouteOptions): RenderedPublicSiteRoute {
  const route = resolveGraphleSiteRoute(runtime, path);
  const items = listGraphleSiteItemViews(runtime);
  const title = routeTitle(route, runtime);
  const html = renderToStaticMarkup(<PublicSiteShell items={items} route={route} title={title} />);

  return {
    html,
    items,
    route,
    status: route.kind === "not-found" ? 404 : 200,
    title,
  };
}
