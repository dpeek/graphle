import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  createSyncedTypeClient,
  type SyncedTypeClient,
  type TotalSyncPayload,
} from "#graph";

import { appNamespace, resolveBrowserRuntimeConfig, type AppRuntimeConfig } from "../config.js";

export type AppRuntime = SyncedTypeClient<typeof appNamespace>;

const runtimeCache = new Map<string, Promise<AppRuntime>>();

const AppRuntimeContext = createContext<AppRuntime | null>(null);

async function fetchSyncPayload(syncUrl: string): Promise<TotalSyncPayload> {
  const response = await fetch(syncUrl, {
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Sync request failed with ${response.status} ${response.statusText}.`);
  }

  return (await response.json()) as TotalSyncPayload;
}

export async function createAppRuntime(config: AppRuntimeConfig): Promise<AppRuntime> {
  const runtime = createSyncedTypeClient(appNamespace, {
    pull: () => fetchSyncPayload(config.syncUrl),
  });

  await runtime.sync.sync();
  return runtime;
}

export function loadSharedAppRuntime(config: AppRuntimeConfig): Promise<AppRuntime> {
  const cached = runtimeCache.get(config.syncUrl);
  if (cached) return cached;

  const pending = createAppRuntime(config).catch((error) => {
    runtimeCache.delete(config.syncUrl);
    throw error;
  });
  runtimeCache.set(config.syncUrl, pending);
  return pending;
}

export function resetSharedAppRuntime(config: AppRuntimeConfig): void {
  runtimeCache.delete(config.syncUrl);
}

export function useAppRuntime(): AppRuntime {
  const runtime = useContext(AppRuntimeContext);
  if (!runtime) {
    throw new Error("App runtime is not available outside the synced runtime provider.");
  }
  return runtime;
}

type AppBootstrapProps = {
  config?: AppRuntimeConfig;
  loadRuntime?: (config: AppRuntimeConfig) => Promise<AppRuntime>;
  renderApp?: () => ReactNode;
};

type BootstrapState =
  | { status: "loading" }
  | { status: "ready"; runtime: AppRuntime }
  | { status: "error"; error: unknown };

function formatBootstrapError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function LoadingState({ config }: { config: AppRuntimeConfig }) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100"
      data-app-bootstrap="loading"
    >
      <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/30">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Graph sync</p>
        <h1 className="mt-3 text-2xl font-semibold">Loading authoritative graph</h1>
        <p className="mt-2 text-sm text-slate-300">
          Waiting for the first total snapshot from <code>{config.syncUrl}</code>.
        </p>
      </div>
    </main>
  );
}

function ErrorState({
  config,
  error,
  onRetry,
}: {
  config: AppRuntimeConfig;
  error: unknown;
  onRetry(): void;
}) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-rose-950 px-6 text-rose-50"
      data-app-bootstrap="error"
    >
      <div className="w-full max-w-md rounded-[1.75rem] border border-rose-200/20 bg-black/20 p-6 shadow-2xl shadow-rose-950/30">
        <p className="text-xs uppercase tracking-[0.28em] text-rose-200">Sync failed</p>
        <h1 className="mt-3 text-2xl font-semibold">Unable to load the graph</h1>
        <p className="mt-2 text-sm text-rose-100/85">{formatBootstrapError(error)}</p>
        <p className="mt-2 text-xs text-rose-100/65">
          Endpoint: <code>{config.syncUrl}</code>
        </p>
        <button
          className="mt-5 rounded-full border border-rose-100/25 bg-rose-100/10 px-4 py-2 text-sm font-medium"
          onClick={onRetry}
          type="button"
        >
          Retry sync
        </button>
      </div>
    </main>
  );
}

export function AppRuntimeBootstrap({
  config,
  loadRuntime = loadSharedAppRuntime,
  renderApp,
}: AppBootstrapProps) {
  const [resolvedConfig] = useState(() => config ?? resolveBrowserRuntimeConfig());
  const [state, setState] = useState<BootstrapState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    loadRuntime(resolvedConfig)
      .then((runtime) => {
        if (cancelled) return;
        setState({ status: "ready", runtime });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ status: "error", error });
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, loadRuntime, resolvedConfig]);

  if (state.status === "loading") {
    return <LoadingState config={resolvedConfig} />;
  }

  if (state.status === "error") {
    return (
      <ErrorState
        config={resolvedConfig}
        error={state.error}
        onRetry={() => {
          resetSharedAppRuntime(resolvedConfig);
          setAttempt((current) => current + 1);
        }}
      />
    );
  }

  return (
    <AppRuntimeContext.Provider value={state.runtime}>
      {renderApp?.() ?? null}
    </AppRuntimeContext.Provider>
  );
}
