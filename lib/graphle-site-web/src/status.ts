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

export interface GraphleSiteDeployMetadata {
  readonly accountId: string;
  readonly workerName: string;
  readonly workerUrl: string;
  readonly sourceCursor: string;
  readonly baselineHash: string;
  readonly deployedAt: string;
  readonly status: "ready" | "error";
  readonly errorSummary?: string;
}

export interface GraphleSiteDeployStatus {
  readonly state: "idle" | "checking" | "deploying" | "ready" | "error";
  readonly credentials: {
    readonly accountId?: string;
    readonly workerName?: string;
    readonly hasApiToken: boolean;
    readonly missing: readonly string[];
  };
  readonly metadata: GraphleSiteDeployMetadata | null;
  readonly currentBaseline?: {
    readonly sourceCursor: string;
    readonly baselineHash: string;
    readonly generatedAt: string;
    readonly matchesLastDeploy: boolean;
  };
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly status?: number;
    readonly retryable: boolean;
  };
}

export interface GraphleSiteStatusSnapshot {
  readonly loadedAt: string;
  readonly health: GraphleSiteHealth;
  readonly session: GraphleSiteSession;
  readonly deploy?: GraphleSiteDeployStatus;
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
  const deploy = session.authenticated
    ? await readJson<GraphleSiteDeployStatus>(fetcher, "/api/deploy/status")
    : undefined;

  return {
    loadedAt: now().toISOString(),
    health,
    session,
    ...(deploy ? { deploy } : {}),
    path,
  };
}
