import {
  compareSiteItems,
  parseSitePublicRoute,
  siteIconPresetForId,
  siteItemMatchesSearch,
  siteVisibilityForId,
  siteVisibilityIdFor,
  type SiteIconPreset,
  type SiteVisibility,
} from "@dpeek/graphle-module-site";

import type { GraphleSiteGraphClient } from "./graph.js";
import type { GraphleSiteRoute, GraphleSiteRouteItem, GraphleSiteRouteTag } from "./status.js";

export type GraphleSiteItemRef = ReturnType<GraphleSiteGraphClient["graph"]["item"]["ref"]>;
export type GraphleSiteItemView = GraphleSiteRouteItem;

export interface GraphleSiteItemOrder {
  readonly id: string;
  readonly sortOrder: number;
}

function formatDate(value: Date | string | undefined): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return undefined;
}

function requireDate(value: Date | string | undefined): string {
  return formatDate(value) ?? new Date(0).toISOString();
}

function formatUrl(value: URL | string | undefined): string | undefined {
  if (value instanceof URL) return value.toString();
  if (typeof value === "string") return value;
  return undefined;
}

function serializeVisibility(visibilityId: string): SiteVisibility {
  return siteVisibilityForId(visibilityId) ?? "private";
}

function serializeIcon(iconId: string | undefined): SiteIconPreset | undefined {
  return iconId ? siteIconPresetForId(iconId) : undefined;
}

function serializeTag(tag: {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly color: string;
}): GraphleSiteRouteTag {
  return {
    id: tag.id,
    key: tag.key,
    name: tag.name,
    color: tag.color,
  };
}

function slugifyPathSegment(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "untitled";
}

export function allocateGraphleSitePath(
  runtime: GraphleSiteGraphClient,
  title = "Untitled",
): string {
  const base = `/${slugifyPathSegment(title)}`;
  const existingPaths = new Set(
    runtime.graph.item
      .list()
      .map((item) => item.path)
      .filter((path): path is string => typeof path === "string" && path.length > 0),
  );

  if (!existingPaths.has(base)) return base;

  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!existingPaths.has(candidate)) return candidate;
  }
}

export function serializeGraphleSiteItem(
  runtime: GraphleSiteGraphClient,
  item: ReturnType<GraphleSiteGraphClient["graph"]["item"]["list"]>[number],
): GraphleSiteItemView {
  const tagById = new Map(runtime.graph.tag.list().map((tag) => [tag.id, tag]));
  const tags = (item.tags ?? [])
    .map((id) => tagById.get(id))
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
    .map(serializeTag);
  const icon = serializeIcon(item.icon);
  const url = formatUrl(item.url);

  return {
    id: item.id,
    title: item.title,
    ...(item.path ? { path: item.path } : {}),
    ...(url ? { url } : {}),
    ...(item.body ? { body: item.body } : {}),
    visibility: serializeVisibility(item.visibility),
    ...(icon ? { icon } : {}),
    tags,
    ...(typeof item.sortOrder === "number" ? { sortOrder: item.sortOrder } : {}),
    createdAt: requireDate(item.createdAt),
    updatedAt: requireDate(item.updatedAt),
  };
}

export function listGraphleSiteItemViews(
  runtime: GraphleSiteGraphClient,
  options: { readonly includePrivate?: boolean; readonly query?: string } = {},
): readonly GraphleSiteItemView[] {
  return runtime.graph.item
    .list()
    .map((item) => serializeGraphleSiteItem(runtime, item))
    .filter((item) => options.includePrivate || item.visibility === "public")
    .filter((item) => siteItemMatchesSearch(item, options.query ?? ""))
    .sort(compareSiteItems);
}

export function findGraphleSiteItemView(
  runtime: GraphleSiteGraphClient,
  id: string,
): GraphleSiteItemView | undefined {
  const item = runtime.graph.item.list().find((candidate) => candidate.id === id);
  return item ? serializeGraphleSiteItem(runtime, item) : undefined;
}

export function findGraphleSiteItemRef(
  runtime: GraphleSiteGraphClient,
  id: string | undefined,
): GraphleSiteItemRef | undefined {
  if (!id) return undefined;
  if (!runtime.graph.item.list().some((item) => item.id === id)) return undefined;
  return runtime.graph.item.ref(id);
}

export function resolveGraphleSiteRoute(
  runtime: GraphleSiteGraphClient,
  path: string,
  options: { readonly includePrivate?: boolean } = {},
): GraphleSiteRoute {
  let routePath = path;
  try {
    routePath = parseSitePublicRoute(path).path;
  } catch {
    return {
      kind: "not-found",
      path,
      message: `No site route exists at ${path}.`,
    };
  }

  const item = listGraphleSiteItemViews(runtime, options).find(
    (candidate) => candidate.path === routePath,
  );

  return item
    ? {
        kind: "item",
        path: routePath,
        item,
      }
    : {
        kind: "not-found",
        path: routePath,
        message: `No visible item exists at ${routePath}.`,
      };
}

export function createBlankGraphleSiteItem(runtime: GraphleSiteGraphClient): GraphleSiteItemView {
  const id = runtime.graph.item.create({
    title: "Untitled",
    path: allocateGraphleSitePath(runtime),
    visibility: siteVisibilityIdFor("private"),
    tags: [],
  });
  const item = findGraphleSiteItemView(runtime, id);
  if (!item) throw new Error("Created site item was not readable from the graph runtime.");
  return item;
}

export function reorderGraphleSiteItems(
  runtime: GraphleSiteGraphClient,
  items: readonly GraphleSiteItemOrder[],
): void {
  const first = items[0];
  if (!first) return;
  runtime.graph.item.ref(first.id).batch(() => {
    for (const item of items) {
      runtime.graph.item.update(item.id, {
        sortOrder: item.sortOrder,
      });
    }
  });
}

export function deleteGraphleSiteItem(runtime: GraphleSiteGraphClient, id: string): void {
  runtime.graph.item.delete(id);
}
