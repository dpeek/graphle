import {
  GraphValidationError,
  createTypeClient,
  type GraphValidationIssue,
  type GraphValidationResult,
  type NamespaceClient,
  validateGraphStore,
} from "./client"
import { bootstrap } from "./bootstrap"
import type { AnyTypeOutput } from "./schema"
import { createStore, type Store, type StoreSnapshot } from "./store"

export type SyncCompleteness = "complete" | "incomplete"
export type SyncFreshness = "current" | "stale"
export type SyncStatus = "idle" | "syncing" | "ready" | "error"

export type SyncScope = {
  readonly kind: "graph"
}

export const graphSyncScope: SyncScope = Object.freeze({ kind: "graph" })

export type TotalSyncPayload = {
  readonly mode: "total"
  readonly scope: SyncScope
  readonly snapshot: StoreSnapshot
  readonly cursor: string
  readonly completeness: "complete"
  readonly freshness: SyncFreshness
}

const totalSyncPayloadValidationKey = "$sync:payload"

function createPayloadValidationIssue(
  path: readonly string[],
  code: string,
  message: string,
): GraphValidationIssue {
  return {
    source: "runtime",
    code,
    message,
    path: Object.freeze([...path]),
    predicateKey: totalSyncPayloadValidationKey,
    nodeId: totalSyncPayloadValidationKey,
  }
}

function invalidPayloadResult(
  payload: TotalSyncPayload,
  issues: readonly GraphValidationIssue[],
): Extract<GraphValidationResult<TotalSyncPayload>, { ok: false }> {
  return {
    ok: false,
    phase: "authoritative",
    event: "reconcile",
    value: payload,
    changedPredicateKeys: issues.length > 0 ? [totalSyncPayloadValidationKey] : [],
    issues,
  }
}

function prepareTotalSyncPayload(
  payload: TotalSyncPayload,
  options: {
    preserveSnapshot?: StoreSnapshot
  } = {},
):
  | {
      ok: true
      value: TotalSyncPayload
    }
  | {
      ok: false
      result: Extract<GraphValidationResult<TotalSyncPayload>, { ok: false }>
    } {
  const issues = validateTotalSyncPayloadShape(payload)
  if (issues.length > 0) {
    return {
      ok: false,
      result: invalidPayloadResult(payload, issues),
    }
  }

  return {
    ok: true,
    value: materializeTotalSyncPayload(payload, options.preserveSnapshot),
  }
}

function withValidationValue<TValue>(
  result: GraphValidationResult<void>,
  value: TValue,
): GraphValidationResult<TValue> {
  return result.ok
    ? {
        ...result,
        value,
      }
    : {
        ...result,
        value,
      }
}

function cloneValidationIssue(issue: GraphValidationIssue): GraphValidationIssue {
  return {
    ...issue,
    path: Object.freeze([...issue.path]),
  }
}

function cloneTotalSyncPayload(payload: TotalSyncPayload): TotalSyncPayload {
  return {
    ...payload,
    scope: { ...payload.scope },
    snapshot: {
      edges: payload.snapshot.edges.map((edge) => ({ ...edge })),
      retracted: [...payload.snapshot.retracted],
    },
  }
}

function exposeTotalSyncValidationResult(
  result: GraphValidationResult<TotalSyncPayload>,
): GraphValidationResult<TotalSyncPayload> {
  if (result.ok) {
    return {
      ...result,
      value: cloneTotalSyncPayload(result.value),
      changedPredicateKeys: [...result.changedPredicateKeys],
    }
  }

  return {
    ...result,
    value: cloneTotalSyncPayload(result.value),
    changedPredicateKeys: [...result.changedPredicateKeys],
    issues: result.issues.map((issue) => cloneValidationIssue(issue)),
  }
}

function logicalFactKey(edge: StoreSnapshot["edges"][number]): string {
  return `${edge.s}\0${edge.p}\0${edge.o}`
}

function materializeTotalSyncPayload(
  payload: TotalSyncPayload,
  preserveSnapshot?: StoreSnapshot,
): TotalSyncPayload {
  if (
    !preserveSnapshot ||
    (preserveSnapshot.edges.length === 0 && preserveSnapshot.retracted.length === 0)
  ) {
    return payload
  }

  const retractedIds = new Set(payload.snapshot.retracted)
  const currentFactKeys = new Set(
    payload.snapshot.edges
      .filter((edge) => !retractedIds.has(edge.id))
      .map((edge) => logicalFactKey(edge)),
  )
  const edgeIds = new Set(payload.snapshot.edges.map((edge) => edge.id))
  const mergedRetractedIds = new Set(payload.snapshot.retracted)
  const edges = payload.snapshot.edges.map((edge) => ({ ...edge }))
  const retracted = [...payload.snapshot.retracted]

  for (const edge of preserveSnapshot.edges) {
    if (currentFactKeys.has(logicalFactKey(edge))) continue
    if (edgeIds.has(edge.id)) continue
    edges.push({ ...edge })
    edgeIds.add(edge.id)
  }

  for (const edgeId of preserveSnapshot.retracted) {
    if (!edgeIds.has(edgeId) || mergedRetractedIds.has(edgeId)) continue
    retracted.push(edgeId)
    mergedRetractedIds.add(edgeId)
  }

  return {
    ...payload,
    snapshot: {
      edges,
      retracted,
    },
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}

function validateStoreSnapshotShape(snapshot: unknown): readonly GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = []
  if (!isObjectRecord(snapshot)) {
    issues.push(
      createPayloadValidationIssue(
        ["snapshot"],
        "sync.snapshot",
        'Field "snapshot" must be a store snapshot object.',
      ),
    )
    return issues
  }

  const edgeIds = new Set<string>()

  if (!Array.isArray(snapshot.edges)) {
    issues.push(
      createPayloadValidationIssue(
        ["snapshot", "edges"],
        "sync.snapshot.edges",
        'Field "snapshot.edges" must be an array.',
      ),
    )
  } else {
    snapshot.edges.forEach((edge, index) => {
      const edgePath = `edges[${index}]`
      if (!isObjectRecord(edge)) {
        issues.push(
          createPayloadValidationIssue(
            ["snapshot", edgePath],
            "sync.snapshot.edge",
            `Field "snapshot.${edgePath}" must be an edge object.`,
          ),
        )
        return
      }

      for (const key of ["id", "s", "p", "o"] as const) {
        const value = edge[key]
        if (typeof value !== "string") {
          issues.push(
            createPayloadValidationIssue(
              ["snapshot", edgePath, key],
              `sync.snapshot.edge.${key}`,
              `Field "snapshot.${edgePath}.${key}" must be a string.`,
            ),
          )
        }
      }

      if (typeof edge.id !== "string") return
      if (edgeIds.has(edge.id)) {
        issues.push(
          createPayloadValidationIssue(
            ["snapshot", edgePath, "id"],
            "sync.snapshot.edge.id.duplicate",
            `Field "snapshot.${edgePath}.id" must be unique within the snapshot.`,
          ),
        )
        return
      }
      edgeIds.add(edge.id)
    })
  }

  if (!Array.isArray(snapshot.retracted)) {
    issues.push(
      createPayloadValidationIssue(
        ["snapshot", "retracted"],
        "sync.snapshot.retracted",
        'Field "snapshot.retracted" must be an array.',
      ),
    )
  } else {
    snapshot.retracted.forEach((edgeId, index) => {
      const retractedPath = `retracted[${index}]`
      if (typeof edgeId !== "string") {
        issues.push(
          createPayloadValidationIssue(
            ["snapshot", retractedPath],
            "sync.snapshot.retracted.id",
            `Field "snapshot.${retractedPath}" must be a string edge id.`,
          ),
        )
        return
      }

      if (!edgeIds.has(edgeId)) {
        issues.push(
          createPayloadValidationIssue(
            ["snapshot", retractedPath],
            "sync.snapshot.retracted.missing",
            `Field "snapshot.${retractedPath}" must reference an edge id present in "snapshot.edges".`,
          ),
        )
      }
    })
  }

  return issues
}

function validateTotalSyncPayloadShape(payload: TotalSyncPayload): readonly GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = []
  const candidate = payload as Partial<TotalSyncPayload> & Record<string, unknown>

  if (candidate.mode !== "total") {
    issues.push(
      createPayloadValidationIssue(
        ["mode"],
        "sync.mode",
        'Field "mode" must be "total".',
      ),
    )
  }

  if (!isObjectRecord(candidate.scope) || candidate.scope.kind !== "graph") {
    issues.push(
      createPayloadValidationIssue(
        ["scope", "kind"],
        "sync.scope",
        'Field "scope.kind" must be "graph".',
      ),
    )
  }

  if (typeof candidate.cursor !== "string") {
    issues.push(
      createPayloadValidationIssue(
        ["cursor"],
        "sync.cursor",
        'Field "cursor" must be a string.',
      ),
    )
  }

  if (candidate.completeness !== "complete") {
    issues.push(
      createPayloadValidationIssue(
        ["completeness"],
        "sync.completeness",
        'Field "completeness" must be "complete" for total sync payloads.',
      ),
    )
  }

  if (candidate.freshness !== "current" && candidate.freshness !== "stale") {
    issues.push(
      createPayloadValidationIssue(
        ["freshness"],
        "sync.freshness",
        'Field "freshness" must be "current" or "stale".',
      ),
    )
  }

  issues.push(...validateStoreSnapshotShape(candidate.snapshot))
  return issues
}

export type SyncState = {
  readonly mode: "total"
  readonly scope: SyncScope
  readonly status: SyncStatus
  readonly completeness: SyncCompleteness
  readonly freshness: SyncFreshness
  readonly cursor?: string
  readonly lastSyncedAt?: Date
  readonly error?: unknown
}

export type SyncStateListener = (state: SyncState) => void
export type TotalSyncSource = () => TotalSyncPayload | Promise<TotalSyncPayload>
export type TotalSyncPayloadValidator = (payload: TotalSyncPayload) => void

export interface TotalSyncController {
  apply(payload: TotalSyncPayload): TotalSyncPayload
  sync(): Promise<TotalSyncPayload>
  getState(): SyncState
  subscribe(listener: SyncStateListener): () => void
}

export type SyncedTypeClient<T extends Record<string, AnyTypeOutput>> = {
  store: Store
  graph: NamespaceClient<T>
  sync: TotalSyncController
}

export interface TotalSyncSession {
  apply(payload: TotalSyncPayload): TotalSyncPayload
  pull(source: TotalSyncSource): Promise<TotalSyncPayload>
  getState(): SyncState
  subscribe(listener: SyncStateListener): () => void
}

export function validateAuthoritativeTotalSyncPayload<
  const T extends Record<string, AnyTypeOutput>,
>(
  payload: TotalSyncPayload,
  namespace: T,
  options: {
    preserveSnapshot?: StoreSnapshot
  } = {},
): GraphValidationResult<TotalSyncPayload> {
  const prepared = prepareTotalSyncPayload(payload, options)
  if (!prepared.ok) return prepared.result

  const materialized = prepared.value
  const validationStore = createStore()
  validationStore.replace(materialized.snapshot)
  return exposeTotalSyncValidationResult(
    withValidationValue(validateGraphStore(validationStore, namespace), materialized),
  )
}

export function createAuthoritativeTotalSyncValidator<
  const T extends Record<string, AnyTypeOutput>,
>(
  namespace: T,
  options: {
    preserveSnapshot?: StoreSnapshot
  } = {},
): TotalSyncPayloadValidator {
  return (payload) => {
    const result = validateAuthoritativeTotalSyncPayload(payload, namespace, options)
    if (!result.ok) throw new GraphValidationError(result)
  }
}

function cloneState(state: SyncState): SyncState {
  return {
    ...state,
    scope: graphSyncScope,
    lastSyncedAt: state.lastSyncedAt ? new Date(state.lastSyncedAt.getTime()) : undefined,
  }
}

export function createTotalSyncSession(
  store: Store,
  options: {
    validate?: TotalSyncPayloadValidator
    preserveSnapshot?: StoreSnapshot
  } = {},
): TotalSyncSession {
  let state: SyncState = {
    mode: "total",
    scope: graphSyncScope,
    status: "idle",
    completeness: "incomplete",
    freshness: "stale",
  }
  const listeners = new Set<SyncStateListener>()

  function publish(next: SyncState): void {
    state = next
    const snapshot = cloneState(state)
    for (const listener of new Set(listeners)) listener(snapshot)
  }

  function apply(payload: TotalSyncPayload): TotalSyncPayload {
    const prepared = prepareTotalSyncPayload(payload, options)
    if (!prepared.ok) throw new GraphValidationError(prepared.result)

    const materialized = prepared.value
    options.validate?.(materialized)
    store.replace(materialized.snapshot)
    publish({
      mode: materialized.mode,
      scope: materialized.scope,
      status: "ready",
      completeness: materialized.completeness,
      freshness: materialized.freshness,
      cursor: materialized.cursor,
      lastSyncedAt: new Date(),
    })
    return materialized
  }

  async function pull(source: TotalSyncSource): Promise<TotalSyncPayload> {
    publish({
      ...state,
      status: "syncing",
      error: undefined,
    })

    try {
      return apply(await source())
    } catch (error) {
      publish({
        ...state,
        status: "error",
        freshness: "stale",
        error,
      })
      throw error
    }
  }

  function getState(): SyncState {
    return cloneState(state)
  }

  function subscribe(listener: SyncStateListener): () => void {
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  }

  return {
    apply,
    pull,
    getState,
    subscribe,
  }
}

export function createTotalSyncPayload(
  store: Store,
  options: {
    cursor?: string
    freshness?: SyncFreshness
  } = {},
): TotalSyncPayload {
  return {
    mode: "total",
    scope: graphSyncScope,
    snapshot: store.snapshot(),
    cursor: options.cursor ?? "full",
    completeness: "complete",
    freshness: options.freshness ?? "current",
  }
}

export function createTotalSyncController(
  store: Store,
  options: {
    pull: TotalSyncSource
    validate?: TotalSyncPayloadValidator
    preserveSnapshot?: StoreSnapshot
  },
): TotalSyncController {
  const session = createTotalSyncSession(store, {
    preserveSnapshot: options.preserveSnapshot,
    validate: options.validate,
  })

  return {
    apply: session.apply,
    sync() {
      return session.pull(options.pull)
    },
    getState: session.getState,
    subscribe: session.subscribe,
  }
}

export function createSyncedTypeClient<const T extends Record<string, AnyTypeOutput>>(
  namespace: T,
  options: {
    pull: TotalSyncSource
  },
): SyncedTypeClient<T> {
  const store = createStore()
  bootstrap(store)
  bootstrap(store, namespace)
  const preserveSnapshot = store.snapshot()
  const graph = createTypeClient(store, namespace)
  const session = createTotalSyncSession(store, {
    preserveSnapshot,
    validate: createAuthoritativeTotalSyncValidator(namespace),
  })

  return {
    store,
    graph,
    sync: {
      apply: session.apply,
      sync() {
        return session.pull(options.pull)
      },
      getState: session.getState,
      subscribe: session.subscribe,
    },
  }
}
