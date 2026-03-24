import {
  createPersistedAuthoritativeGraph,
  createStore,
  createTypeClient,
  type AnyTypeOutput,
  type AuthoritativeGraphRetainedHistoryPolicy,
  type PersistedAuthoritativeGraph,
  type PersistedAuthoritativeGraphStorage,
  type PersistedAuthoritativeGraphStorageCommitInput,
  type PersistedAuthoritativeGraphStorageLoadResult,
  type PersistedAuthoritativeGraphStoragePersistInput,
  type Store,
  type StoreSnapshot,
} from "@io/core/graph";
import {
  createRetainedWorkflowProjectionState,
  createWorkflowProjectionIndexFromRetainedState,
  type RetainedWorkflowProjectionState,
  workflowSchema,
} from "@io/core/graph/modules/ops/workflow";

import type {
  WebAppAuthoritySecretInventoryRecord,
  WebAppAuthoritySecretRecord,
  WebAppAuthoritySecretWrite,
  WebAppAuthorityStorage,
} from "./authority.js";

type WorkflowProjectionRef = {
  current: RetainedWorkflowProjectionState | null;
};

type PendingSecretWriteRef = {
  current: WebAppAuthoritySecretWrite | null;
};

export type WebAppAuthorityBootstrapRefs = {
  readonly pendingSecretWriteRef: PendingSecretWriteRef;
  readonly retainedWorkflowProjectionRef: WorkflowProjectionRef;
};

function clonePersistedValue<T>(value: T): T {
  return structuredClone(value);
}

function headCursor(
  writeHistory: PersistedAuthoritativeGraphStoragePersistInput["writeHistory"],
): string {
  return (
    writeHistory.results.at(-1)?.cursor ??
    `${writeHistory.cursorPrefix}${writeHistory.baseSequence}`
  );
}

export function buildRetainedWorkflowProjectionState(
  snapshot: StoreSnapshot,
  sourceCursor: string,
): RetainedWorkflowProjectionState {
  const projectionStore = createStore(snapshot);
  return createRetainedWorkflowProjectionState(createTypeClient(projectionStore, workflowSchema), {
    sourceCursor,
  });
}

export type SecretStartupDrift = {
  readonly invalidSecretIds: readonly string[];
  readonly liveSecretIds: readonly string[];
  readonly missingSecretIds: readonly string[];
  readonly orphanedSecretIds: readonly string[];
  readonly versionMismatches: ReadonlyArray<{
    readonly graphVersion: number;
    readonly secretId: string;
    readonly storedVersion: number;
  }>;
};

export function toSecretInventory(
  secrets:
    | Record<string, WebAppAuthoritySecretInventoryRecord>
    | Record<string, WebAppAuthoritySecretRecord>,
): Record<string, WebAppAuthoritySecretInventoryRecord> {
  return Object.fromEntries(
    Object.entries(secrets)
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([secretId, secret]) => [secretId, { version: secret.version }]),
  );
}

export function collectLiveSecretIds(
  snapshot: StoreSnapshot,
  typePredicateId: string,
  secretHandleTypeId: string,
): readonly string[] {
  const retractedEdgeIds = new Set(snapshot.retracted);
  const secretHandleIds = new Set<string>();

  for (const edge of snapshot.edges) {
    if (retractedEdgeIds.has(edge.id)) continue;
    if (edge.p === typePredicateId && edge.o === secretHandleTypeId) {
      secretHandleIds.add(edge.s);
    }
  }

  if (secretHandleIds.size === 0) {
    return [];
  }

  const liveSecretIds = new Set<string>();
  for (const edge of snapshot.edges) {
    if (retractedEdgeIds.has(edge.id)) continue;
    if (secretHandleIds.has(edge.o)) {
      liveSecretIds.add(edge.o);
    }
  }

  return [...liveSecretIds].sort((left, right) => left.localeCompare(right));
}

export function resolveSecretStartupDrift(input: {
  readonly snapshot: StoreSnapshot;
  readonly graph: Record<string, AnyTypeOutput>;
  readonly secretHandleVersionPredicateId: string;
  readonly secretInventory: Record<string, WebAppAuthoritySecretInventoryRecord>;
  readonly typePredicateId: string;
  readonly secretHandleTypeId: string;
}): SecretStartupDrift {
  const liveSecretIds = collectLiveSecretIds(
    input.snapshot,
    input.typePredicateId,
    input.secretHandleTypeId,
  );
  const liveSecretIdSet = new Set(liveSecretIds);
  const persistedStore = createStore(input.snapshot);
  const missingSecretIds: string[] = [];
  const invalidSecretIds: string[] = [];
  const versionMismatches: Array<{
    readonly graphVersion: number;
    readonly secretId: string;
    readonly storedVersion: number;
  }> = [];

  for (const secretId of liveSecretIds) {
    const rawGraphVersion = persistedStore.get(secretId, input.secretHandleVersionPredicateId);
    const graphVersion =
      typeof rawGraphVersion === "number"
        ? rawGraphVersion
        : Number.parseInt(rawGraphVersion ?? "", 10);
    if (!Number.isInteger(graphVersion)) {
      invalidSecretIds.push(secretId);
      continue;
    }

    const stored = input.secretInventory[secretId];
    if (!stored) {
      missingSecretIds.push(secretId);
      continue;
    }
    if (stored.version !== graphVersion) {
      versionMismatches.push({
        secretId,
        graphVersion,
        storedVersion: stored.version,
      });
    }
  }

  return {
    invalidSecretIds,
    liveSecretIds,
    missingSecretIds,
    orphanedSecretIds: Object.keys(input.secretInventory)
      .filter((secretId) => !liveSecretIdSet.has(secretId))
      .sort((left, right) => left.localeCompare(right)),
    versionMismatches: versionMismatches.sort((left, right) =>
      left.secretId.localeCompare(right.secretId),
    ),
  };
}

export async function loadAuthorityBootstrapState(input: {
  readonly graph: Record<string, AnyTypeOutput>;
  readonly secretHandleVersionPredicateId: string;
  readonly secretHandleTypeId: string;
  readonly storage: WebAppAuthorityStorage;
  readonly typePredicateId: string;
  readonly createSecretStorageDriftError: (drift: SecretStartupDrift) => Error;
  readonly hasBlockingSecretStartupDrift: (drift: SecretStartupDrift) => boolean;
}): Promise<{
  readonly persistedSecrets: Record<string, WebAppAuthoritySecretRecord>;
  readonly persistedState: PersistedAuthoritativeGraphStorageLoadResult | null;
  readonly persistedWorkflowProjection: RetainedWorkflowProjectionState | null;
}> {
  const persistedState = await input.storage.load();
  const persistedWorkflowProjection = persistedState
    ? await input.storage.loadWorkflowProjection()
    : null;
  let persistedSecrets: Record<string, WebAppAuthoritySecretRecord> = {};

  if (persistedState) {
    const startupSecretInventory = await input.storage.inspectSecrets();
    const startupDrift = resolveSecretStartupDrift({
      snapshot: persistedState.snapshot,
      graph: input.graph,
      secretHandleVersionPredicateId: input.secretHandleVersionPredicateId,
      secretInventory: startupSecretInventory,
      typePredicateId: input.typePredicateId,
      secretHandleTypeId: input.secretHandleTypeId,
    });
    if (input.hasBlockingSecretStartupDrift(startupDrift)) {
      throw input.createSecretStorageDriftError(startupDrift);
    }
    if (startupDrift.orphanedSecretIds.length > 0) {
      await input.storage.repairSecrets({
        liveSecretIds: startupDrift.liveSecretIds,
      });
    }
    persistedSecrets =
      startupDrift.liveSecretIds.length > 0
        ? await input.storage.loadSecrets({ secretIds: startupDrift.liveSecretIds })
        : {};

    const loadedSecretDrift = resolveSecretStartupDrift({
      snapshot: persistedState.snapshot,
      graph: input.graph,
      secretHandleVersionPredicateId: input.secretHandleVersionPredicateId,
      secretInventory: toSecretInventory(persistedSecrets),
      typePredicateId: input.typePredicateId,
      secretHandleTypeId: input.secretHandleTypeId,
    });
    if (input.hasBlockingSecretStartupDrift(loadedSecretDrift)) {
      throw input.createSecretStorageDriftError(loadedSecretDrift);
    }
  }

  return {
    persistedSecrets,
    persistedState,
    persistedWorkflowProjection,
  };
}

function sameRetainedWorkflowProjectionState(
  left: RetainedWorkflowProjectionState,
  right: RetainedWorkflowProjectionState,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function classifyRetainedWorkflowProjectionRecovery(
  retained: RetainedWorkflowProjectionState | null,
  authoritative: RetainedWorkflowProjectionState,
): "missing" | "incompatible" | "stale" | null {
  if (!retained) {
    return "missing";
  }

  try {
    createWorkflowProjectionIndexFromRetainedState(retained);
  } catch {
    return "incompatible";
  }

  return sameRetainedWorkflowProjectionState(retained, authoritative) ? null : "stale";
}

export async function createBootstrappedWebAuthority<
  Graph extends Record<string, AnyTypeOutput>,
>(input: {
  readonly createCursorPrefix: () => string;
  readonly createSecretStorageDriftError: (drift: SecretStartupDrift) => Error;
  readonly graph: Graph;
  readonly hasBlockingSecretStartupDrift: (drift: SecretStartupDrift) => boolean;
  readonly retainedHistoryPolicy?: AuthoritativeGraphRetainedHistoryPolicy;
  readonly secretHandleTypeId: string;
  readonly secretHandleVersionPredicateId: string;
  readonly seed?: () => void | Promise<void>;
  readonly storage: WebAppAuthorityStorage;
  readonly store: Store;
  readonly typePredicateId: string;
}): Promise<{
  readonly authority: PersistedAuthoritativeGraph<Graph>;
  readonly persistedSecrets: Record<string, WebAppAuthoritySecretRecord>;
  readonly refs: WebAppAuthorityBootstrapRefs;
  readonly rebuildRetainedWorkflowProjection: () => Promise<void>;
  readonly replaceRetainedWorkflowProjection: (
    workflowProjection: RetainedWorkflowProjectionState,
  ) => Promise<void>;
}> {
  const { persistedSecrets, persistedState, persistedWorkflowProjection } =
    await loadAuthorityBootstrapState({
      graph: input.graph,
      secretHandleVersionPredicateId: input.secretHandleVersionPredicateId,
      typePredicateId: input.typePredicateId,
      secretHandleTypeId: input.secretHandleTypeId,
      storage: input.storage,
      createSecretStorageDriftError: input.createSecretStorageDriftError,
      hasBlockingSecretStartupDrift: input.hasBlockingSecretStartupDrift,
    });
  const refs: WebAppAuthorityBootstrapRefs = {
    pendingSecretWriteRef: {
      current: null,
    },
    retainedWorkflowProjectionRef: {
      current: persistedWorkflowProjection
        ? clonePersistedValue(persistedWorkflowProjection)
        : null,
    },
  };
  const authority = await createPersistedAuthoritativeGraph(input.store, input.graph, {
    storage: createAuthorityStorageAdapter({
      storage: input.storage,
      pendingSecretWriteRef: refs.pendingSecretWriteRef,
      retainedWorkflowProjectionRef: refs.retainedWorkflowProjectionRef,
      preloadedPersistedState: persistedState,
    }),
    seed() {
      return input.seed?.();
    },
    createCursorPrefix: input.createCursorPrefix,
    retainedHistoryPolicy: input.retainedHistoryPolicy,
  });

  async function replaceRetainedWorkflowProjection(
    workflowProjection: RetainedWorkflowProjectionState,
  ): Promise<void> {
    await input.storage.replaceWorkflowProjection(clonePersistedValue(workflowProjection));
    refs.retainedWorkflowProjectionRef.current = clonePersistedValue(workflowProjection);
  }

  async function rebuildRetainedWorkflowProjection(): Promise<void> {
    const workflowProjection = buildRetainedWorkflowProjectionState(
      authority.store.snapshot(),
      authority.createSyncPayload().cursor,
    );
    await replaceRetainedWorkflowProjection(workflowProjection);
  }

  const recoveredWorkflowProjection = buildRetainedWorkflowProjectionState(
    authority.store.snapshot(),
    authority.createSyncPayload().cursor,
  );
  if (
    classifyRetainedWorkflowProjectionRecovery(
      refs.retainedWorkflowProjectionRef.current,
      recoveredWorkflowProjection,
    )
  ) {
    await replaceRetainedWorkflowProjection(recoveredWorkflowProjection);
  }

  return {
    authority,
    persistedSecrets,
    refs,
    rebuildRetainedWorkflowProjection,
    replaceRetainedWorkflowProjection,
  };
}

export function createAuthorityStorageAdapter(input: {
  readonly pendingSecretWriteRef: PendingSecretWriteRef;
  readonly preloadedPersistedState: PersistedAuthoritativeGraphStorageLoadResult | null;
  readonly retainedWorkflowProjectionRef: WorkflowProjectionRef;
  readonly storage: WebAppAuthorityStorage;
}): PersistedAuthoritativeGraphStorage {
  // This adapter is the explicit boundary between the stable graph/runtime
  // persisted-authority contract and web-only secret side storage.
  let preloadedLoadUsed = false;

  return {
    async load(): Promise<PersistedAuthoritativeGraphStorageLoadResult | null> {
      if (!preloadedLoadUsed) {
        preloadedLoadUsed = true;
        const persistedState = input.preloadedPersistedState;
        if (!persistedState) return null;

        return {
          snapshot: clonePersistedValue(persistedState.snapshot),
          writeHistory: persistedState.writeHistory
            ? clonePersistedValue(persistedState.writeHistory)
            : undefined,
          recovery: persistedState.recovery,
          startupDiagnostics: clonePersistedValue(persistedState.startupDiagnostics),
        };
      }

      const persistedState = await input.storage.load();
      if (!persistedState) return null;

      return {
        snapshot: clonePersistedValue(persistedState.snapshot),
        writeHistory: persistedState.writeHistory
          ? clonePersistedValue(persistedState.writeHistory)
          : undefined,
        recovery: persistedState.recovery,
        startupDiagnostics: clonePersistedValue(persistedState.startupDiagnostics),
      };
    },
    async commit(persistedInput: PersistedAuthoritativeGraphStorageCommitInput): Promise<void> {
      const secretWrite = input.pendingSecretWriteRef.current
        ? clonePersistedValue(input.pendingSecretWriteRef.current)
        : undefined;
      const workflowProjection = buildRetainedWorkflowProjectionState(
        persistedInput.snapshot,
        headCursor(persistedInput.writeHistory),
      );

      try {
        await input.storage.commit(clonePersistedValue(persistedInput), {
          ...(secretWrite ? { secretWrite } : {}),
          workflowProjection,
        });
        input.retainedWorkflowProjectionRef.current = clonePersistedValue(workflowProjection);
      } finally {
        input.pendingSecretWriteRef.current = null;
      }
    },
    async persist(persistedInput: PersistedAuthoritativeGraphStoragePersistInput): Promise<void> {
      const workflowProjection = buildRetainedWorkflowProjectionState(
        persistedInput.snapshot,
        headCursor(persistedInput.writeHistory),
      );
      await input.storage.persist(clonePersistedValue(persistedInput), {
        workflowProjection,
      });
      input.retainedWorkflowProjectionRef.current = clonePersistedValue(workflowProjection);
    },
  };
}
