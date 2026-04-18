import { GraphRuntimeProvider } from "@dpeek/graphle-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { GraphleSitePreview, type GraphleSiteStatusState } from "./site-feature.js";
import {
  createGraphlePublicSiteRuntimeFromBaseline,
  createGraphleSiteHttpGraphClient,
  type GraphlePublicSiteRuntime,
  type GraphleSiteGraphClient,
  type GraphleSiteReadonlyRuntime,
} from "./graph.js";
import {
  createBlankGraphleSiteItem,
  deleteGraphleSiteItem,
  findGraphleSiteItemView,
  reorderGraphleSiteItems,
  type GraphleSiteItemOrder,
  type GraphleSiteItemView,
} from "./site-items.js";
import { loadGraphleSiteStatus, type GraphleSiteDeployStatus } from "./status.js";

export interface GraphleCloudflareDeployRequest {
  readonly accountId?: string;
  readonly apiToken?: string;
  readonly workerName?: string;
}

export interface GraphleSiteShellProps {
  readonly path?: string;
  readonly runtime?: GraphleSiteReadonlyRuntime | null;
  readonly status: GraphleSiteStatusState;
  readonly onCreateBlankItem?: () => Promise<GraphleSiteItemView>;
  readonly onDeleteItem?: (id: string) => Promise<void>;
  readonly onNavigatePath?: (path: string) => Promise<void> | void;
  readonly onRefresh?: () => void;
  readonly onReorderItems?: (items: readonly GraphleSiteItemOrder[]) => Promise<void>;
  readonly onDeployCloudflare?: (input: GraphleCloudflareDeployRequest) => Promise<void>;
}

export function GraphleSiteShell({
  path,
  runtime,
  status,
  onCreateBlankItem,
  onDeleteItem,
  onNavigatePath,
  onRefresh,
  onReorderItems,
  onDeployCloudflare,
}: GraphleSiteShellProps) {
  return (
    <GraphleSitePreview
      path={path}
      runtime={runtime}
      status={status}
      onCreateBlankItem={onCreateBlankItem}
      onDeleteItem={onDeleteItem}
      onNavigatePath={onNavigatePath}
      onRefresh={onRefresh}
      onReorderItems={onReorderItems}
      onDeployCloudflare={onDeployCloudflare}
    />
  );
}

function currentOrigin(): string {
  return typeof window === "undefined" ? "http://127.0.0.1:4318/" : window.location.origin;
}

function readEmbeddedPublicRuntime(): GraphlePublicSiteRuntime | null {
  if (typeof document === "undefined") return null;
  const script = document.getElementById("graphle-public-site-baseline");
  const payload = script?.textContent;
  if (!payload) return null;
  return createGraphlePublicSiteRuntimeFromBaseline(JSON.parse(payload));
}

function deployingStatus(previous: GraphleSiteDeployStatus | undefined): GraphleSiteDeployStatus {
  return {
    state: "deploying",
    credentials: previous?.credentials ?? {
      hasApiToken: false,
      missing: ["accountId", "apiToken"],
    },
    metadata: previous?.metadata ?? null,
    ...(previous?.currentBaseline ? { currentBaseline: previous.currentBaseline } : {}),
  };
}

function failedDeployStatus(
  previous: GraphleSiteDeployStatus | undefined,
  payload: unknown,
): GraphleSiteDeployStatus {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const message =
    typeof record.error === "string" ? record.error : "Cloudflare deploy request failed.";
  const code = typeof record.code === "string" ? record.code : "deploy.failed";
  const status = typeof record.status === "number" ? record.status : undefined;
  const retryable = typeof record.retryable === "boolean" ? record.retryable : false;

  return {
    state: "error",
    credentials: previous?.credentials ?? {
      hasApiToken: false,
      missing: ["accountId", "apiToken"],
    },
    metadata: previous?.metadata ?? null,
    ...(previous?.currentBaseline ? { currentBaseline: previous.currentBaseline } : {}),
    error: {
      code,
      message,
      ...(status ? { status } : {}),
      retryable,
    },
  };
}

export function GraphleSiteApp() {
  const [status, setStatus] = useState<GraphleSiteStatusState>({ state: "loading" });
  const [path, setPath] = useState("/");
  const [runtime, setRuntime] = useState<GraphleSiteReadonlyRuntime | null>(null);
  const runtimeRef = useRef<GraphleSiteGraphClient | null>(null);
  const publicRuntimeRef = useRef<GraphlePublicSiteRuntime | null>(null);

  const ensureRuntime = useCallback(async (authenticated: boolean) => {
    if (!authenticated) {
      runtimeRef.current = null;
      publicRuntimeRef.current ??= readEmbeddedPublicRuntime();
      setRuntime(publicRuntimeRef.current);
      return publicRuntimeRef.current;
    }

    publicRuntimeRef.current = null;
    if (runtimeRef.current) {
      await runtimeRef.current.sync.sync();
      setRuntime(runtimeRef.current);
      return runtimeRef.current;
    }

    const nextRuntime = await createGraphleSiteHttpGraphClient({
      url: currentOrigin(),
    });
    runtimeRef.current = nextRuntime;
    setRuntime(nextRuntime);
    return nextRuntime;
  }, []);

  const loadPath = useCallback(
    async (nextPath: string) => {
      setPath(nextPath);
      setStatus({ state: "loading" });
      try {
        const snapshot = await loadGraphleSiteStatus({ path: nextPath });
        await ensureRuntime(snapshot.session.authenticated);
        setStatus({ state: "ready", snapshot });
      } catch (error) {
        setRuntime(null);
        runtimeRef.current = null;
        setStatus({
          state: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [ensureRuntime],
  );

  const refresh = useCallback(() => {
    void loadPath(window.location.pathname || "/");
  }, [loadPath]);

  const navigatePath = useCallback(
    async (nextPath: string) => {
      const pathToLoad = nextPath || "/";
      if (window.location.pathname !== pathToLoad) {
        window.history.pushState(null, "", pathToLoad);
      }
      await loadPath(pathToLoad);
    },
    [loadPath],
  );

  function requireRuntime(): GraphleSiteGraphClient {
    if (!runtimeRef.current) {
      throw new Error("Graph runtime is not available for site authoring.");
    }
    return runtimeRef.current;
  }

  const mutationRuntime = runtime && "sync" in runtime ? runtime : null;

  const deployCloudflare = useCallback(
    async (input: GraphleCloudflareDeployRequest) => {
      setStatus((previous) =>
        previous.state === "ready"
          ? {
              state: "ready",
              snapshot: {
                ...previous.snapshot,
                deploy: deployingStatus(previous.snapshot.deploy),
              },
            }
          : previous,
      );

      const response = await fetch("/api/deploy", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      });
      const payload = await response.json().catch(() => undefined);
      if (!response.ok) {
        setStatus((previous) =>
          previous.state === "ready"
            ? {
                state: "ready",
                snapshot: {
                  ...previous.snapshot,
                  deploy: failedDeployStatus(previous.snapshot.deploy, payload),
                },
              }
            : previous,
        );
        throw new Error(
          payload &&
            typeof payload === "object" &&
            typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : `Deploy request returned HTTP ${response.status}`,
        );
      }

      await loadPath(path);
    },
    [loadPath, path],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function handlePopState() {
      void loadPath(window.location.pathname || "/");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [loadPath]);

  return (
    <GraphRuntimeProvider runtime={mutationRuntime}>
      <GraphleSiteShell
        path={path}
        runtime={runtime}
        status={status}
        onCreateBlankItem={async () => {
          const graphRuntime = requireRuntime();
          const created = createBlankGraphleSiteItem(graphRuntime);
          await graphRuntime.sync.flush();
          return findGraphleSiteItemView(graphRuntime, created.id) ?? created;
        }}
        onDeleteItem={async (id) => {
          const graphRuntime = requireRuntime();
          deleteGraphleSiteItem(graphRuntime, id);
          await graphRuntime.sync.flush();
        }}
        onNavigatePath={navigatePath}
        onDeployCloudflare={deployCloudflare}
        onRefresh={refresh}
        onReorderItems={async (items) => {
          const graphRuntime = requireRuntime();
          reorderGraphleSiteItems(graphRuntime, items);
          await graphRuntime.sync.flush();
        }}
      />
    </GraphRuntimeProvider>
  );
}
