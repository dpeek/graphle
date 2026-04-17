import type { SiteIconPreset, SiteVisibility } from "@dpeek/graphle-module-site";

export interface GraphleSiteHealth {
  readonly ok?: boolean;
  readonly service?: {
    readonly name?: string;
    readonly status?: string;
    readonly startedAt?: string;
  };
  readonly project?: {
    readonly id?: string;
  };
  readonly database?: {
    readonly opened?: boolean;
    readonly metaTableReady?: boolean;
    readonly schemaVersion?: number;
  };
  readonly graph?: {
    readonly status?: string;
    readonly records?: {
      readonly items?: number;
      readonly tags?: number;
    };
    readonly startupDiagnostics?: {
      readonly recovery?: string;
    };
  };
}

export interface GraphleSiteSession {
  readonly authenticated: boolean;
  readonly session: {
    readonly projectId?: string;
    readonly subject?: string;
  } | null;
}

export interface GraphleSiteRouteTag {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly color: string;
}

export interface GraphleSiteRouteItem {
  readonly id: string;
  readonly title: string;
  readonly path?: string;
  readonly url?: string;
  readonly body?: string;
  readonly visibility: SiteVisibility;
  readonly icon?: SiteIconPreset;
  readonly tags: readonly GraphleSiteRouteTag[];
  readonly sortOrder?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type GraphleSiteRoute =
  | {
      readonly kind: "item";
      readonly path: string;
      readonly item: GraphleSiteRouteItem;
    }
  | {
      readonly kind: "not-found";
      readonly path: string;
      readonly message: string;
    };

export interface GraphleSiteRoutePayload {
  readonly route: GraphleSiteRoute;
  readonly items: readonly GraphleSiteRouteItem[];
}

export interface GraphleSiteStatusSnapshot {
  readonly loadedAt: string;
  readonly health: GraphleSiteHealth;
  readonly session: GraphleSiteSession;
  readonly route: GraphleSiteRoute;
  readonly items: readonly GraphleSiteRouteItem[];
}

export type GraphleSiteStatusFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

async function readJson<T>(fetcher: GraphleSiteStatusFetcher, path: string): Promise<T> {
  const response = await fetcher(path, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

function routePath(path: string): string {
  const params = new URLSearchParams();
  params.set("path", path);
  return `/api/site/route?${params.toString()}`;
}

export async function loadGraphleSiteStatus({
  fetcher = fetch,
  now = () => new Date(),
  path = "/",
}: {
  readonly fetcher?: GraphleSiteStatusFetcher;
  readonly now?: () => Date;
  readonly path?: string;
} = {}): Promise<GraphleSiteStatusSnapshot> {
  const [health, session, routePayload] = await Promise.all([
    readJson<GraphleSiteHealth>(fetcher, "/api/health"),
    readJson<GraphleSiteSession>(fetcher, "/api/session"),
    readJson<GraphleSiteRoutePayload>(fetcher, routePath(path)),
  ]);

  return {
    loadedAt: now().toISOString(),
    health,
    session,
    route: routePayload.route,
    items: routePayload.items,
  };
}
