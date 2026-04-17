import { useCallback, useEffect, useState } from "react";

import { GraphleSitePreview, type GraphleSiteStatusState } from "./site-feature.js";
import {
  createBlankGraphleSiteItem,
  deleteGraphleSiteItem,
  loadGraphleSiteStatus,
  reorderGraphleSiteItems,
  updateGraphleSiteItem,
  type GraphleSiteItem,
  type GraphleSiteItemInput,
  type GraphleSiteItemOrderInput,
} from "./status.js";

export interface GraphleSiteShellProps {
  readonly path?: string;
  readonly status: GraphleSiteStatusState;
  readonly onCreateBlankItem?: () => Promise<GraphleSiteItem>;
  readonly onDeleteItem?: (id: string) => Promise<void>;
  readonly onNavigatePath?: (path: string) => Promise<void> | void;
  readonly onRefresh?: () => void;
  readonly onReorderItems?: (items: readonly GraphleSiteItemOrderInput[]) => Promise<void>;
  readonly onUpdateItem?: (id: string, input: GraphleSiteItemInput) => Promise<GraphleSiteItem>;
}

export function GraphleSiteShell({
  status,
  onCreateBlankItem,
  onDeleteItem,
  onNavigatePath,
  onRefresh,
  onReorderItems,
  onUpdateItem,
}: GraphleSiteShellProps) {
  return (
    <GraphleSitePreview
      status={status}
      onCreateBlankItem={onCreateBlankItem}
      onDeleteItem={onDeleteItem}
      onNavigatePath={onNavigatePath}
      onRefresh={onRefresh}
      onReorderItems={onReorderItems}
      onUpdateItem={onUpdateItem}
    />
  );
}

export function GraphleSiteApp() {
  const [status, setStatus] = useState<GraphleSiteStatusState>({ state: "loading" });
  const [path, setPath] = useState("/");

  const loadPath = useCallback(async (nextPath: string) => {
    setPath(nextPath);
    setStatus({ state: "loading" });
    try {
      const snapshot = await loadGraphleSiteStatus({ path: nextPath });
      setStatus({ state: "ready", snapshot });
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

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
    <GraphleSiteShell
      path={path}
      status={status}
      onCreateBlankItem={() => createBlankGraphleSiteItem()}
      onDeleteItem={async (id) => {
        await deleteGraphleSiteItem(id);
        refresh();
      }}
      onNavigatePath={navigatePath}
      onRefresh={refresh}
      onReorderItems={async (items) => {
        await reorderGraphleSiteItems(items);
        refresh();
      }}
      onUpdateItem={async (id, input) => {
        const item = await updateGraphleSiteItem(id, input);
        refresh();
        return item;
      }}
    />
  );
}
