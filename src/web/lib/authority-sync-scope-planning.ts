import {
  createModuleReadScope,
  createModuleSyncScope,
  matchesModuleReadScopeRequest,
  type AuthorizationContext,
  type AuthoritativeGraphWriteResult,
  type GraphWriteTransaction,
  type ModuleSyncScope,
  type Store,
  type StoreSnapshot,
  type SyncDiagnostics,
} from "@io/core/graph";
import { workflowReviewModuleReadScope } from "@io/core/graph/modules/ops/workflow";

const moduleScopeCursorPrefix = "scope:";

export type WebAppAuthoritySyncScopeRequest =
  | {
      readonly kind?: "graph";
    }
  | {
      readonly kind: "module";
      readonly moduleId: string;
      readonly scopeId: string;
    };

export type PlannedWebAppAuthorityScope = {
  readonly scope: ModuleSyncScope;
  readonly typeIds: ReadonlySet<string>;
};

function isGraphScopeRequest(
  scope: WebAppAuthoritySyncScopeRequest | undefined,
): scope is { readonly kind?: "graph" } | undefined {
  return scope === undefined || scope.kind === undefined || scope.kind === "graph";
}

function createPolicyFilterVersion(policyVersion: number): string {
  return `policy:${policyVersion}`;
}

export function formatScopedModuleCursor(scope: ModuleSyncScope, cursor: string): string {
  const params = new URLSearchParams();
  params.set("kind", scope.kind);
  params.set("moduleId", scope.moduleId);
  params.set("scopeId", scope.scopeId);
  params.set("definitionHash", scope.definitionHash);
  params.set("policyFilterVersion", scope.policyFilterVersion);
  params.set("cursor", cursor);
  return `${moduleScopeCursorPrefix}${params.toString()}`;
}

export function formatScopedSyncDiagnostics(
  scope: ModuleSyncScope,
  diagnostics: SyncDiagnostics | undefined,
): SyncDiagnostics | undefined {
  if (!diagnostics) return undefined;
  return {
    ...diagnostics,
    retainedBaseCursor: formatScopedModuleCursor(scope, diagnostics.retainedBaseCursor),
  };
}

export function parseScopedModuleCursor(
  cursor: string,
): (ModuleSyncScope & { readonly cursor: string }) | null {
  if (!cursor.startsWith(moduleScopeCursorPrefix)) return null;

  const params = new URLSearchParams(cursor.slice(moduleScopeCursorPrefix.length));
  if (params.get("kind") !== "module") return null;
  const moduleId = params.get("moduleId");
  const scopeId = params.get("scopeId");
  const definitionHash = params.get("definitionHash");
  const policyFilterVersion = params.get("policyFilterVersion");
  const graphCursor = params.get("cursor");
  if (!moduleId || !scopeId || !definitionHash || !policyFilterVersion || !graphCursor) {
    return null;
  }

  return {
    ...createModuleSyncScope({
      moduleId,
      scopeId,
      definitionHash,
      policyFilterVersion,
    }),
    cursor: graphCursor,
  };
}

function resolveScopedSubjectId(
  operation:
    | AuthoritativeGraphWriteResult["transaction"]["ops"][number]
    | GraphWriteTransaction["ops"][number],
  edgeById: Map<string, StoreSnapshot["edges"][number]>,
): string | undefined {
  if (operation.op === "assert") return operation.edge.s;
  return edgeById.get(operation.edgeId)?.s;
}

function subjectTypeId(
  store: Store,
  subjectId: string,
  typePredicateId: string,
): string | undefined {
  return store.get(subjectId, typePredicateId) ?? store.find(subjectId, typePredicateId)[0]?.o;
}

function scopeIncludesSubject(
  store: Store,
  typePredicateId: string,
  typeIds: ReadonlySet<string>,
  subjectId: string,
): boolean {
  const currentTypeId = subjectTypeId(store, subjectId, typePredicateId);
  return currentTypeId !== undefined && typeIds.has(currentTypeId);
}

export function filterModuleScopedSnapshot(
  snapshot: StoreSnapshot,
  store: Store,
  typePredicateId: string,
  plannedScope: PlannedWebAppAuthorityScope,
): StoreSnapshot {
  const edges = snapshot.edges
    .filter((edge) => scopeIncludesSubject(store, typePredicateId, plannedScope.typeIds, edge.s))
    .map((edge) => ({ ...edge }));
  const visibleEdgeIds = new Set(edges.map((edge) => edge.id));

  return {
    edges,
    retracted: snapshot.retracted.filter((edgeId) => visibleEdgeIds.has(edgeId)),
  };
}

export function filterModuleScopedWriteResult(
  result: AuthoritativeGraphWriteResult,
  store: Store,
  edgeById: Map<string, StoreSnapshot["edges"][number]>,
  typePredicateId: string,
  plannedScope: PlannedWebAppAuthorityScope,
): AuthoritativeGraphWriteResult | undefined {
  const ops = result.transaction.ops.filter((operation) => {
    const scopedSubjectId = resolveScopedSubjectId(operation, edgeById);
    if (!scopedSubjectId) return true;
    return scopeIncludesSubject(store, typePredicateId, plannedScope.typeIds, scopedSubjectId);
  });
  if (ops.length === 0) return undefined;

  return {
    ...result,
    cursor: formatScopedModuleCursor(plannedScope.scope, result.cursor),
    transaction: {
      ...result.transaction,
      ops,
    },
  };
}

export function collectTouchedTypeIdsForTransaction(
  snapshot: StoreSnapshot,
  store: Store,
  typePredicateId: string,
  transaction: GraphWriteTransaction,
): readonly string[] {
  const edgeById = new Map(snapshot.edges.map((edge) => [edge.id, edge]));
  const typeIds = new Set<string>();

  for (const operation of transaction.ops) {
    if (operation.op === "assert" && operation.edge.p === typePredicateId) {
      typeIds.add(operation.edge.o);
    }
    const subjectId = resolveScopedSubjectId(operation, edgeById);
    if (!subjectId) continue;
    const subjectType = subjectTypeId(store, subjectId, typePredicateId);
    if (subjectType) {
      typeIds.add(subjectType);
    }
  }

  return [...typeIds];
}

export function planRequestedSyncScope(
  scope: WebAppAuthoritySyncScopeRequest | undefined,
  authorization: AuthorizationContext,
  workflowModuleEntityTypeIds: ReadonlySet<string>,
  createScopeNotFoundError: (scopeId: string, moduleId: string) => Error,
): PlannedWebAppAuthorityScope | undefined {
  if (isGraphScopeRequest(scope)) return undefined;

  if (!matchesModuleReadScopeRequest(scope, workflowReviewModuleReadScope)) {
    throw createScopeNotFoundError(scope.scopeId, scope.moduleId);
  }

  return {
    scope: createModuleReadScope(
      workflowReviewModuleReadScope,
      createPolicyFilterVersion(authorization.policyVersion),
    ),
    typeIds: workflowModuleEntityTypeIds,
  };
}
