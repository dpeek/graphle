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

export interface GraphleSiteStatusSnapshot {
  readonly loadedAt: string;
  readonly health: GraphleSiteHealth;
  readonly session: GraphleSiteSession;
  readonly path: string;
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

export async function loadGraphleSiteStatus({
  fetcher = fetch,
  now = () => new Date(),
  path = "/",
}: {
  readonly fetcher?: GraphleSiteStatusFetcher;
  readonly now?: () => Date;
  readonly path?: string;
} = {}): Promise<GraphleSiteStatusSnapshot> {
  const [health, session] = await Promise.all([
    readJson<GraphleSiteHealth>(fetcher, "/api/health"),
    readJson<GraphleSiteSession>(fetcher, "/api/session"),
  ]);

  return {
    loadedAt: now().toISOString(),
    health,
    session,
    path,
  };
}
