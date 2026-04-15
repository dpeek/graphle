import { createGraphClient, type GraphClient } from "@dpeek/graphle-client";
import {
  type AnyTypeOutput,
  type GraphStore,
  type GraphStoreSnapshot,
  sameAuthoritativeGraphRetainedHistoryPolicy,
  type AuthoritativeGraphChangesAfterResult,
  type AuthoritativeGraphRetainedHistoryPolicy,
  type AuthoritativeGraphWriteHistory,
  type AuthoritativeGraphWriteResult,
  type GraphWriteScope,
  type GraphWriteTransaction,
} from "@dpeek/graphle-kernel";
import { type IncrementalSyncResult, type SyncFreshness } from "@dpeek/graphle-sync";

import { resolveAuthoritativeDefinitions } from "./definitions.js";
import type { ReplicationReadAuthorizer } from "./session-contracts.js";
import {
  createAuthoritativeGraphWriteSession,
  createAuthoritativeTotalSyncPayload,
} from "./session.js";

export const persistedAuthoritativeGraphStateVersion = 1 as const;

export type PersistedAuthoritativeGraphStateVersion =
  typeof persistedAuthoritativeGraphStateVersion;

/**
 * Semantic retained record committed atomically beside authoritative graph
 * state.
 *
 * The shared authority runtime treats these records as opaque payloads. Host
 * runtimes own record-family-specific migration, materialization, and repair
 * logic.
 */
export type PersistedAuthoritativeGraphRetainedRecord = {
  readonly recordKind: string;
  readonly recordId: string;
  readonly version: number;
  readonly payload: unknown;
};

/**
 * Shared durable authority state published by the graph runtime.
 *
 * Storage adapters may persist this shape directly or reconstruct it from a
 * different on-disk layout, but downstream branches should only depend on this
 * snapshot-plus-history-plus-retained-records contract.
 */
export type PersistedAuthoritativeGraphState = {
  readonly version: PersistedAuthoritativeGraphStateVersion;
  readonly snapshot: GraphStoreSnapshot;
  readonly writeHistory: AuthoritativeGraphWriteHistory;
  readonly retainedRecords?: readonly PersistedAuthoritativeGraphRetainedRecord[];
};

/**
 * Hydrated authority state returned by a storage adapter.
 *
 * `recovery` makes baseline rewrite rules explicit across adapters:
 *
 * - `"none"` means the persisted baseline and retained history can resume as-is
 * - `"repair"` means the retained history still supports the hydrated
 *   snapshot, but adapter metadata or normalized history should be rewritten
 * - `"reset-baseline"` means the hydrated snapshot can no longer be backed by
 *   retained history, so the runtime must publish a fresh baseline cursor
 */
export type PersistedAuthoritativeGraphStorageRecovery = "none" | "repair" | "reset-baseline";

export type PersistedAuthoritativeGraphStartupRepairReason =
  | "retained-history-policy-normalized"
  | "write-history-write-scope-normalized"
  | "head-sequence-mismatch"
  | "head-cursor-mismatch"
  | "retained-history-boundary-mismatch";

export type PersistedAuthoritativeGraphStartupResetReason =
  | "missing-write-history"
  | "retained-history-base-sequence-invalid"
  | "retained-history-sequence-mismatch"
  | "retained-history-head-mismatch"
  | "retained-history-replay-failed";

export type PersistedAuthoritativeGraphStartupDiagnostics = {
  readonly recovery: PersistedAuthoritativeGraphStorageRecovery;
  readonly repairReasons: readonly PersistedAuthoritativeGraphStartupRepairReason[];
  readonly resetReasons: readonly PersistedAuthoritativeGraphStartupResetReason[];
};

export type PersistedAuthoritativeGraphStorageLoadResult = {
  readonly snapshot: GraphStoreSnapshot;
  readonly writeHistory?: AuthoritativeGraphWriteHistory;
  readonly retainedRecords?: readonly PersistedAuthoritativeGraphRetainedRecord[];
  readonly recovery: PersistedAuthoritativeGraphStorageRecovery;
  readonly startupDiagnostics: PersistedAuthoritativeGraphStartupDiagnostics;
};

/**
 * Incremental durable commit for one accepted authoritative transaction.
 *
 * This is the stable shared commit boundary. Adapter-specific row ids, SQL
 * statements, and transport concerns stay outside this input shape.
 */
export type PersistedAuthoritativeGraphStorageCommitInput = {
  readonly snapshot: GraphStoreSnapshot;
  readonly transaction: GraphWriteTransaction;
  readonly result: AuthoritativeGraphWriteResult;
  readonly writeHistory: AuthoritativeGraphWriteHistory;
  readonly retainedRecords?: readonly PersistedAuthoritativeGraphRetainedRecord[];
};

/**
 * Full durable snapshot rewrite for the current authority baseline.
 */
export type PersistedAuthoritativeGraphStoragePersistInput = {
  readonly snapshot: GraphStoreSnapshot;
  readonly writeHistory: AuthoritativeGraphWriteHistory;
  readonly retainedRecords?: readonly PersistedAuthoritativeGraphRetainedRecord[];
};

/**
 * Bootstrap-only seeding callback run when no durable authority state exists.
 *
 * The callback receives a typed graph client over the authority store, and any
 * accepted writes become part of the first persisted baseline.
 */
export type PersistedAuthoritativeGraphSeed<
  TNamespace extends Record<string, AnyTypeOutput>,
  TDefinitions extends Record<string, AnyTypeOutput> = TNamespace,
> = (graph: GraphClient<TNamespace, TDefinitions>) => void | Promise<void>;

export type PersistedAuthoritativeGraphCursorPrefixFactory = () => string;

/**
 * Stable storage boundary between the shared persisted-authority runtime and a
 * durable adapter implementation.
 *
 * The runtime depends only on `load`, per-transaction `commit`, and baseline
 * `persist`. File formats, SQL tables, Durable Object wiring, and secret side
 * storage remain adapter-specific concerns.
 */
export interface PersistedAuthoritativeGraphStorage {
  load(): Promise<PersistedAuthoritativeGraphStorageLoadResult | null>;
  commit(input: PersistedAuthoritativeGraphStorageCommitInput): Promise<void>;
  persist(input: PersistedAuthoritativeGraphStoragePersistInput): Promise<void>;
}

export type JsonPersistedAuthoritativeGraphOptions<
  TNamespace extends Record<string, AnyTypeOutput>,
  TDefinitions extends Record<string, AnyTypeOutput> = TNamespace,
> = {
  readonly definitions?: TDefinitions;
  readonly path: string;
  readonly seed?: PersistedAuthoritativeGraphSeed<TNamespace, TDefinitions>;
  readonly createCursorPrefix?: PersistedAuthoritativeGraphCursorPrefixFactory;
  readonly retainedHistoryPolicy?: AuthoritativeGraphRetainedHistoryPolicy;
};

export type PersistedAuthoritativeGraphOptions<
  TNamespace extends Record<string, AnyTypeOutput>,
  TDefinitions extends Record<string, AnyTypeOutput> = TNamespace,
> = {
  readonly definitions?: TDefinitions;
  readonly storage: PersistedAuthoritativeGraphStorage;
  readonly seed?: PersistedAuthoritativeGraphSeed<TNamespace, TDefinitions>;
  readonly createCursorPrefix?: PersistedAuthoritativeGraphCursorPrefixFactory;
  readonly retainedHistoryPolicy?: AuthoritativeGraphRetainedHistoryPolicy;
};

/**
 * Shared durable authority runtime backed by retained history plus one current
 * store snapshot.
 *
 * Startup diagnostics distinguish between `"repair"` and `"reset-baseline"`
 * recovery:
 *
 * - `"repair"` means the hydrated snapshot is still justified by retained
 *   history, but adapter metadata or normalized history must be rewritten
 * - `"reset-baseline"` means retained history can no longer justify the
 *   hydrated snapshot, so the runtime publishes a fresh baseline cursor before
 *   serving incremental callers
 *
 * Any durable commit or explicit persist failure rolls the in-memory authority
 * back so it does not diverge from storage.
 */
export type PersistedAuthoritativeGraph<
  TNamespace extends Record<string, AnyTypeOutput>,
  TDefinitions extends Record<string, AnyTypeOutput> = TNamespace,
> = {
  readonly store: GraphStore;
  readonly graph: GraphClient<TNamespace, TDefinitions>;
  readonly startupDiagnostics: PersistedAuthoritativeGraphStartupDiagnostics;
  /**
   * Creates a full sync payload from the current authority baseline.
   */
  createTotalSyncPayload(options?: {
    authorizeRead?: ReplicationReadAuthorizer;
    freshness?: SyncFreshness;
  }): ReturnType<typeof createAuthoritativeTotalSyncPayload>;
  /**
   * Validates, applies, and durably commits one authoritative write.
   */
  applyTransaction(
    transaction: GraphWriteTransaction,
    options?: {
      writeScope?: GraphWriteScope;
    },
  ): Promise<AuthoritativeGraphWriteResult>;
  getChangesAfter(cursor?: string): AuthoritativeGraphChangesAfterResult;
  /**
   * Returns incremental sync output, or a reset fallback when the caller's
   * cursor no longer fits within retained history.
   */
  getIncrementalSyncResult(
    after?: string,
    options?: {
      authorizeRead?: ReplicationReadAuthorizer;
      freshness?: SyncFreshness;
    },
  ): IncrementalSyncResult;
  getRetainedHistoryPolicy(): AuthoritativeGraphRetainedHistoryPolicy;
  /**
   * Rewrites storage to the current snapshot and starts a fresh retained
   * history window with a new cursor prefix.
   */
  persist(): Promise<void>;
};

let persistedAuthoritativeGraphCursorEpoch = 0;

function createPersistedAuthoritativeGraphCursorPrefix(): string {
  persistedAuthoritativeGraphCursorEpoch = Math.max(
    persistedAuthoritativeGraphCursorEpoch + 1,
    Date.now(),
  );
  return `tx:${persistedAuthoritativeGraphCursorEpoch}:`;
}

/**
 * Creates the shared durable authority runtime on top of an adapter-provided
 * storage boundary.
 *
 * On startup, storage `load()` results are replayed back into a fresh write
 * session. Any replay mismatch upgrades recovery to `"reset-baseline"` so the
 * runtime republishes a new total-sync baseline instead of serving a broken
 * incremental cursor window.
 */
export async function createPersistedAuthoritativeGraph<
  const TNamespace extends Record<string, AnyTypeOutput>,
  const TDefinitions extends Record<string, AnyTypeOutput> = TNamespace,
>(
  store: GraphStore,
  namespace: TNamespace,
  options: PersistedAuthoritativeGraphOptions<TNamespace, TDefinitions>,
): Promise<PersistedAuthoritativeGraph<TNamespace, TDefinitions>> {
  const definitions = resolveAuthoritativeDefinitions(namespace, options.definitions);
  const graph = createGraphClient(store, namespace, definitions);
  const createCursorPrefix =
    options.createCursorPrefix ?? createPersistedAuthoritativeGraphCursorPrefix;
  const createFreshWriteSession = () =>
    createAuthoritativeGraphWriteSession(store, namespace, {
      cursorPrefix: createCursorPrefix(),
      definitions,
      retainedHistoryPolicy: options.retainedHistoryPolicy,
    });
  let writes = createFreshWriteSession();
  const configuredRetainedHistoryPolicy = writes.getRetainedHistoryPolicy();
  const createWriteSession = (writeHistory: AuthoritativeGraphWriteHistory) =>
    createAuthoritativeGraphWriteSession(store, namespace, {
      cursorPrefix: writeHistory.cursorPrefix,
      definitions,
      initialSequence: writeHistory.baseSequence,
      history: writeHistory.results,
      retainedHistoryPolicy: configuredRetainedHistoryPolicy,
    });

  async function persistCurrentState(): Promise<void> {
    await options.storage.persist({
      snapshot: store.snapshot(),
      writeHistory: writes.getHistory(),
    });
  }

  async function persist(): Promise<void> {
    const previousHistory = writes.getHistory();
    writes = createFreshWriteSession();
    try {
      await persistCurrentState();
    } catch (error) {
      writes = createWriteSession(previousHistory);
      throw error;
    }
  }

  async function applyTransaction(
    transaction: GraphWriteTransaction,
    applyOptions: {
      writeScope?: GraphWriteScope;
    } = {},
  ): Promise<AuthoritativeGraphWriteResult> {
    const previousSnapshot = store.snapshot();
    const previousHistory = writes.getHistory();
    const applied = writes.applyWithSnapshot(transaction, {
      ...applyOptions,
      sourceSnapshot: previousSnapshot,
    });
    const currentHistory = writes.getHistory();

    try {
      await options.storage.commit({
        snapshot: applied.snapshot,
        transaction: applied.result.transaction,
        result: applied.result,
        writeHistory: currentHistory,
      });
    } catch (error) {
      store.replace(previousSnapshot);
      writes = createWriteSession(previousHistory);
      throw error;
    }

    return applied.result;
  }

  const persistedState = await options.storage.load();
  let startupDiagnostics: PersistedAuthoritativeGraphStartupDiagnostics = {
    recovery: "none",
    repairReasons: [],
    resetReasons: [],
  };
  if (persistedState) {
    startupDiagnostics = persistedState.startupDiagnostics;
    store.replace(persistedState.snapshot);
    if (persistedState.writeHistory) {
      try {
        writes = createWriteSession(persistedState.writeHistory);
        const hydratedHistory = writes.getHistory();
        if (
          persistedState.recovery === "repair" ||
          !sameAuthoritativeGraphRetainedHistoryPolicy(
            persistedState.writeHistory.retainedHistoryPolicy,
            configuredRetainedHistoryPolicy,
          ) ||
          hydratedHistory.baseSequence !== persistedState.writeHistory.baseSequence ||
          hydratedHistory.results.length !== persistedState.writeHistory.results.length
        ) {
          await persistCurrentState();
        }
      } catch {
        // Any retained-history replay failure is an explicit reset-baseline
        // rewrite because the hydrated snapshot can no longer support the old
        // incremental cursor window.
        startupDiagnostics = {
          recovery: "reset-baseline",
          repairReasons: [],
          resetReasons: ["retained-history-replay-failed"],
        };
        writes = createFreshWriteSession();
        await persistCurrentState();
      }
    } else {
      writes = createFreshWriteSession();
      await persistCurrentState();
    }
  } else {
    if (options.seed) await options.seed(graph);
    writes = createFreshWriteSession();
    await persistCurrentState();
  }

  return {
    store,
    graph,
    startupDiagnostics,
    createTotalSyncPayload(syncOptions = {}) {
      return createAuthoritativeTotalSyncPayload(store, namespace, {
        authorizeRead: syncOptions.authorizeRead,
        cursor: writes.getCursor() ?? writes.getBaseCursor(),
        definitions,
        diagnostics: {
          retainedHistoryPolicy: writes.getRetainedHistoryPolicy(),
          retainedBaseCursor: writes.getBaseCursor(),
        },
        freshness: syncOptions.freshness ?? "current",
      });
    },
    applyTransaction,
    getChangesAfter(cursor) {
      return writes.getChangesAfter(cursor);
    },
    getIncrementalSyncResult(after, syncOptions) {
      return writes.getIncrementalSyncResult(after, syncOptions);
    },
    getRetainedHistoryPolicy() {
      return writes.getRetainedHistoryPolicy();
    },
    persist,
  };
}
