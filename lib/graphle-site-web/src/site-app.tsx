import { GraphRuntimeProvider } from "@dpeek/graphle-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { GraphleSitePreview, type GraphleSiteStatusState } from "./site-feature.js";
import { createGraphleSiteHttpGraphClient, type GraphleSiteGraphClient } from "./graph.js";
import {
  createBlankGraphleSiteItem,
  deleteGraphleSiteItem,
  findGraphleSiteItemView,
  reorderGraphleSiteItems,
  type GraphleSiteItemOrder,
  type GraphleSiteItemView,
} from "./site-items.js";
import { loadGraphleSiteStatus } from "./status.js";

export interface GraphleSiteShellProps {
  readonly path?: string;
  readonly runtime?: GraphleSiteGraphClient | null;
  readonly status: GraphleSiteStatusState;
  readonly onCreateBlankItem?: () => Promise<GraphleSiteItemView>;
  readonly onDeleteItem?: (id: string) => Promise<void>;
  readonly onNavigatePath?: (path: string) => Promise<void> | void;
  readonly onRefresh?: () => void;
  readonly onReorderItems?: (items: readonly GraphleSiteItemOrder[]) => Promise<void>;
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
    />
  );
}

function currentOrigin(): string {
  return typeof window === "undefined" ? "http://127.0.0.1:4318/" : window.location.origin;
}

export function GraphleSiteApp() {
  const [status, setStatus] = useState<GraphleSiteStatusState>({ state: "loading" });
  const [path, setPath] = useState("/");
  const [runtime, setRuntime] = useState<GraphleSiteGraphClient | null>(null);
  const runtimeRef = useRef<GraphleSiteGraphClient | null>(null);

  const ensureRuntime = useCallback(async (authenticated: boolean) => {
    if (!authenticated) {
      runtimeRef.current = null;
      setRuntime(null);
      return null;
    }

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
    <GraphRuntimeProvider runtime={runtime}>
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
