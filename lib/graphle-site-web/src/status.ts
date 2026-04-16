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

export type GraphleSiteVisibility = "private" | "public";

export type GraphleSiteIconPreset =
  | "link"
  | "website"
  | "github"
  | "x"
  | "linkedin"
  | "rss"
  | "email"
  | "book"
  | "note";

export interface GraphleSiteTag {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly color: string;
}

export interface GraphleSiteItem {
  readonly id: string;
  readonly title: string;
  readonly path?: string;
  readonly url?: string;
  readonly body?: string;
  readonly excerpt?: string;
  readonly visibility: GraphleSiteVisibility;
  readonly icon?: GraphleSiteIconPreset;
  readonly tags: readonly GraphleSiteTag[];
  readonly pinned: boolean;
  readonly sortOrder?: number;
  readonly publishedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type GraphleSiteRoute =
  | {
      readonly kind: "item";
      readonly path: string;
      readonly item: GraphleSiteItem;
    }
  | {
      readonly kind: "not-found";
      readonly path: string;
      readonly message: string;
    };

export interface GraphleSiteRoutePayload {
  readonly route: GraphleSiteRoute;
  readonly items: readonly GraphleSiteItem[];
}

export interface GraphleSiteStatusSnapshot {
  readonly loadedAt: string;
  readonly health: GraphleSiteHealth;
  readonly session: GraphleSiteSession;
  readonly route: GraphleSiteRoute;
  readonly items: readonly GraphleSiteItem[];
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

async function writeJson<T>(
  fetcher: GraphleSiteStatusFetcher,
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<T> {
  const response = await fetcher(path, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    readonly error?: string;
    readonly issues?: readonly { readonly path?: string; readonly message?: string }[];
  };
  if (!response.ok) {
    const issue = payload.issues?.find((candidate) => candidate.message);
    throw new Error(issue?.message ?? payload.error ?? `${path} returned HTTP ${response.status}`);
  }

  return payload as T;
}

function routePath(path: string): string {
  const params = new URLSearchParams();
  params.set("path", path);
  return `/api/site/route?${params.toString()}`;
}

async function loadAuthoringItems(
  fetcher: GraphleSiteStatusFetcher,
  session: GraphleSiteSession,
  routeItems: readonly GraphleSiteItem[],
): Promise<readonly GraphleSiteItem[]> {
  if (!session.authenticated) return routeItems;
  const payload = await readJson<{ readonly items: readonly GraphleSiteItem[] }>(
    fetcher,
    "/api/site/items",
  );
  return payload.items;
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
  const items = await loadAuthoringItems(fetcher, session, routePayload.items);

  return {
    loadedAt: now().toISOString(),
    health,
    session,
    route: routePayload.route,
    items,
  };
}

export interface GraphleSiteItemInput {
  readonly title: string;
  readonly path?: string;
  readonly url?: string;
  readonly body?: string;
  readonly excerpt?: string;
  readonly visibility: GraphleSiteVisibility;
  readonly icon?: GraphleSiteIconPreset;
  readonly tags: readonly string[];
  readonly pinned: boolean;
  readonly sortOrder?: number;
  readonly publishedAt?: string;
}

export async function createGraphleSiteItem(
  input: GraphleSiteItemInput,
  fetcher: GraphleSiteStatusFetcher = fetch,
): Promise<GraphleSiteItem> {
  const payload = await writeJson<{ readonly item: GraphleSiteItem }>(
    fetcher,
    "/api/site/items",
    "POST",
    input,
  );
  return payload.item;
}

export async function updateGraphleSiteItem(
  id: string,
  input: GraphleSiteItemInput,
  fetcher: GraphleSiteStatusFetcher = fetch,
): Promise<GraphleSiteItem> {
  const payload = await writeJson<{ readonly item: GraphleSiteItem }>(
    fetcher,
    `/api/site/items/${encodeURIComponent(id)}`,
    "PATCH",
    input,
  );
  return payload.item;
}
