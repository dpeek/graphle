import { createBootstrappedSnapshot } from "@dpeek/graphle-bootstrap";
import type { PersistedAuthoritativeGraph } from "@dpeek/graphle-authority";
import { createGraphStore } from "@dpeek/graphle-kernel";
import { colorType, minimalCore, tag } from "@dpeek/graphle-module-core";
import {
  compareSiteItems,
  parseSitePublicRoute,
  site,
  siteIconPresetForId,
  siteIconPresetIdFor,
  siteItemMatchesSearch,
  siteVisibilityForId,
  siteVisibilityIdFor,
  type SiteIconPreset,
  type SiteVisibility,
} from "@dpeek/graphle-module-site";
import {
  createGraphleSqlitePersistedAuthoritativeGraph,
  type GraphleSqliteHandle,
} from "@dpeek/graphle-sqlite";

export const graphleLocalSiteAuthorityId = "site";

export type LocalSiteGraphNamespace = typeof site & {
  readonly tag: typeof tag;
};
export type LocalSiteGraphDefinitions = typeof minimalCore & {
  readonly color: typeof colorType;
  readonly tag: typeof tag;
} & typeof site;

const localSiteGraphNamespace: LocalSiteGraphNamespace = { ...site, tag };
const localSiteGraphDefinitions: LocalSiteGraphDefinitions = {
  ...minimalCore,
  color: colorType,
  tag,
  ...site,
};
const defaultTagColor = "#2563eb";

export type LocalSiteStartupDiagnostics = {
  readonly recovery: "none" | "repair" | "reset-baseline";
  readonly repairReasons: readonly string[];
  readonly resetReasons: readonly string[];
};

export interface LocalSiteTag {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly color: string;
}

export interface LocalSiteItem {
  readonly id: string;
  readonly title: string;
  readonly path?: string;
  readonly url?: string;
  readonly body?: string;
  readonly visibility: SiteVisibility;
  readonly icon?: SiteIconPreset;
  readonly tags: readonly LocalSiteTag[];
  readonly sortOrder?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type LocalSiteRouteResult =
  | {
      readonly kind: "item";
      readonly path: string;
      readonly item: LocalSiteItem;
    }
  | {
      readonly kind: "not-found";
      readonly path: string;
      readonly message: string;
    };

export interface LocalSiteRoutePayload {
  readonly route: LocalSiteRouteResult;
  readonly items: readonly LocalSiteItem[];
}

export type LocalSiteAuthority = PersistedAuthoritativeGraph<
  LocalSiteGraphNamespace,
  LocalSiteGraphDefinitions
>;

type LocalSiteRawTag = ReturnType<LocalSiteAuthority["graph"]["tag"]["list"]>[number];
type LocalSiteRawItem = ReturnType<LocalSiteAuthority["graph"]["item"]["list"]>[number];

export interface OpenLocalSiteAuthorityOptions {
  readonly sqlite: GraphleSqliteHandle;
  readonly now?: () => Date;
}

export interface LocalSiteHomePage {
  readonly title: string;
  readonly body: string;
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

function serializeTag(tagRecord: LocalSiteRawTag): LocalSiteTag {
  return {
    id: tagRecord.id,
    key: tagRecord.key,
    name: tagRecord.name,
    color: tagRecord.color,
  };
}

function serializeItem(authority: LocalSiteAuthority, item: LocalSiteRawItem): LocalSiteItem {
  const tagById = new Map(authority.graph.tag.list().map((tagRecord) => [tagRecord.id, tagRecord]));
  const tags = (item.tags ?? [])
    .map((id) => tagById.get(id))
    .filter((tagRecord): tagRecord is LocalSiteRawTag => Boolean(tagRecord))
    .map(serializeTag);

  return {
    id: item.id,
    title: item.title,
    ...(item.path ? { path: item.path } : {}),
    ...(item.url ? { url: formatUrl(item.url) } : {}),
    ...(item.body ? { body: item.body } : {}),
    visibility: serializeVisibility(item.visibility),
    ...(serializeIcon(item.icon) ? { icon: serializeIcon(item.icon) } : {}),
    tags,
    ...(typeof item.sortOrder === "number" ? { sortOrder: item.sortOrder } : {}),
    createdAt: requireDate(item.createdAt),
    updatedAt: requireDate(item.updatedAt),
  };
}

function createLocalSiteStore() {
  return createGraphStore(
    createBootstrappedSnapshot(localSiteGraphDefinitions, {
      availableDefinitions: localSiteGraphDefinitions,
      coreSchema: minimalCore,
    }),
  );
}

export async function openLocalSiteAuthority({
  sqlite,
  now = () => new Date(),
}: OpenLocalSiteAuthorityOptions): Promise<LocalSiteAuthority> {
  return createGraphleSqlitePersistedAuthoritativeGraph(
    createLocalSiteStore(),
    localSiteGraphNamespace,
    {
      handle: sqlite,
      authorityId: graphleLocalSiteAuthorityId,
      definitions: localSiteGraphDefinitions,
      seed(graph) {
        const timestamp = now();
        const publicVisibility = siteVisibilityIdFor("public");
        const privateVisibility = siteVisibilityIdFor("private");
        const graphleTag = graph.tag.create({
          name: "Graphle",
          key: "graphle",
          color: defaultTagColor,
        });

        graph.item.create({
          title: "Home",
          path: "/",
          body: "# Home\n\nWelcome to your new Graphle site.",
          visibility: publicVisibility,
          icon: siteIconPresetIdFor("website"),
          tags: [graphleTag],
          sortOrder: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        graph.item.create({
          title: "Example note",
          path: "/notes/example",
          body: "# Example note\n\nThis path-backed item is stored in the local site graph.",
          visibility: publicVisibility,
          icon: siteIconPresetIdFor("note"),
          tags: [graphleTag],
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        graph.item.create({
          title: "GitHub",
          url: new URL("https://github.com/dpeek"),
          visibility: publicVisibility,
          icon: siteIconPresetIdFor("github"),
          tags: [graphleTag],
          sortOrder: 10,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        graph.item.create({
          title: "X",
          url: new URL("https://x.com/dpeekdotcom"),
          visibility: publicVisibility,
          icon: siteIconPresetIdFor("x"),
          tags: [graphleTag],
          sortOrder: 10,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        graph.item.create({
          title: "LinkedIn",
          url: new URL("https://www.linkedin.com/in/dpeekdotcom/"),
          visibility: publicVisibility,
          icon: siteIconPresetIdFor("linkedin"),
          tags: [graphleTag],
          sortOrder: 10,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        graph.item.create({
          title: "Private",
          url: new URL("https://www.linkedin.com/in/dpeekdotcom/"),
          visibility: privateVisibility,
          icon: siteIconPresetIdFor("link"),
          tags: [graphleTag],
          sortOrder: 10,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      },
    },
  );
}

export function listLocalSiteItems(
  authority: LocalSiteAuthority | undefined,
): readonly LocalSiteItem[] {
  return authority
    ? authority.graph.item
        .list()
        .map((item) => serializeItem(authority, item))
        .sort(compareSiteItems)
    : [];
}

export function listPublicLocalSiteItems(
  authority: LocalSiteAuthority | undefined,
): readonly LocalSiteItem[] {
  return listLocalSiteItems(authority).filter((item) => item.visibility === "public");
}

export function searchLocalSiteItems(
  authority: LocalSiteAuthority | undefined,
  query: string,
  options: { readonly includePrivate?: boolean } = {},
): readonly LocalSiteItem[] {
  const items = options.includePrivate
    ? listLocalSiteItems(authority)
    : listPublicLocalSiteItems(authority);
  return items.filter((item) => siteItemMatchesSearch(item, query));
}

export function resolveLocalSiteRoute(
  authority: LocalSiteAuthority | undefined,
  path: string,
  options: { readonly includePrivate?: boolean } = {},
): LocalSiteRouteResult {
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

  const item = (
    options.includePrivate ? listLocalSiteItems(authority) : listPublicLocalSiteItems(authority)
  ).find((candidate) => candidate.path === routePath);

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

export function readLocalSiteRoutePayload(
  authority: LocalSiteAuthority | undefined,
  path: string,
  options: { readonly includePrivate?: boolean } = {},
): LocalSiteRoutePayload {
  return {
    route: resolveLocalSiteRoute(authority, path, options),
    items: options.includePrivate
      ? listLocalSiteItems(authority)
      : listPublicLocalSiteItems(authority),
  };
}

export function readLocalSiteHomePage(
  authority: LocalSiteAuthority | undefined,
): LocalSiteHomePage | undefined {
  const home = listPublicLocalSiteItems(authority).find((item) => item.path === "/");
  if (!home) return undefined;

  return {
    title: home.title,
    body: home.body ?? "",
  };
}

export function readLocalSiteAuthorityHealth(authority: LocalSiteAuthority | undefined) {
  if (!authority) {
    return {
      status: "unavailable" as const,
    };
  }

  return {
    status: "ok" as const,
    startupDiagnostics: authority.startupDiagnostics,
    records: {
      items: listLocalSiteItems(authority).length,
      tags: authority.graph.tag.list().length,
    },
  };
}
