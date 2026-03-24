import {
  authorizeCommand,
  authorizeRead,
  authorizeWrite,
  createStore,
  edgeId,
  type AuthorizationContext,
  type AuthoritativeWriteScope,
  type GraphCommandPolicy,
  type GraphValidationError,
  type GraphWriteTransaction,
  type PolicyError,
  type ReplicationReadAuthorizer,
  type Store,
  type StoreSnapshot,
  validateShareGrant,
} from "@io/core/graph";
import { core } from "@io/core/graph/modules";

import {
  type AuthorizationDecisionTarget,
  type CompiledFieldDefinition,
  createAuthorizationTarget,
} from "./authority-compiled-fields.js";

export type ResolvedAuthorizationCapabilityGrant = {
  readonly id: string;
  readonly statusId?: string;
  readonly resourceKindId: string;
  readonly resourcePredicateId?: string;
  readonly resourceCommandKey?: string;
  readonly resourceSurfaceId?: string;
  readonly targetKindId?: string;
  readonly constraintRootEntityId?: string;
  readonly constraintPredicateIds: readonly string[];
  readonly constraintExpiresAt?: string;
};

export type AuthorizationCapabilityResolver = {
  readonly readKeysFor: (target: AuthorizationDecisionTarget) => readonly string[];
  readonly allowsSharedReadFor: (target: AuthorizationDecisionTarget) => boolean;
  readonly writeKeysFor: (target: AuthorizationDecisionTarget) => readonly string[];
  readonly commandKeysFor: (input: {
    readonly commandKey: string;
    readonly commandPolicy: GraphCommandPolicy;
    readonly touchedPredicates: readonly AuthorizationDecisionTarget[];
  }) => readonly string[];
};

const typePredicateId = edgeId(core.node.fields.type);
const createdAtPredicateId = edgeId(core.node.fields.createdAt);
const updatedAtPredicateId = edgeId(core.node.fields.updatedAt);
const namePredicateId = edgeId(core.node.fields.name);
const principalCapabilityVersionPredicateId = edgeId(core.principal.fields.capabilityVersion);
const capabilityGrantResourceKindPredicateId = edgeId(core.capabilityGrant.fields.resourceKind);
const capabilityGrantResourcePredicateIdPredicateId = edgeId(
  core.capabilityGrant.fields.resourcePredicateId,
);
const capabilityGrantResourceCommandKeyPredicateId = edgeId(
  core.capabilityGrant.fields.resourceCommandKey,
);
const capabilityGrantResourceSurfaceIdPredicateId = edgeId(
  core.capabilityGrant.fields.resourceSurfaceId,
);
const capabilityGrantTargetKindPredicateId = edgeId(core.capabilityGrant.fields.targetKind);
const capabilityGrantTargetPrincipalPredicateId = edgeId(
  core.capabilityGrant.fields.targetPrincipal,
);
const capabilityGrantConstraintRootEntityIdPredicateId = edgeId(
  core.capabilityGrant.fields.constraintRootEntityId,
);
const capabilityGrantConstraintPredicateIdPredicateId = edgeId(
  core.capabilityGrant.fields.constraintPredicateId,
);
const capabilityGrantConstraintExpiresAtPredicateId = edgeId(
  core.capabilityGrant.fields.constraintExpiresAt,
);
const capabilityGrantStatusPredicateId = edgeId(core.capabilityGrant.fields.status);
const shareGrantSurfaceIdPredicateId = edgeId(core.shareGrant.fields.surfaceId);
const shareGrantSurfaceKindPredicateId = edgeId(core.shareGrant.fields.surfaceKind);
const shareGrantSurfaceRootEntityIdPredicateId = edgeId(core.shareGrant.fields.surfaceRootEntityId);
const shareGrantSurfacePredicateIdPredicateId = edgeId(core.shareGrant.fields.surfacePredicateId);
const shareGrantCapabilityGrantPredicateId = edgeId(core.shareGrant.fields.capabilityGrant);
const shareGrantStatusPredicateId = edgeId(core.shareGrant.fields.status);
const principalTypeId = core.principal.values.id;
const authSubjectProjectionTypeId = core.authSubjectProjection.values.id;
const principalRoleBindingTypeId = core.principalRoleBinding.values.id;
const capabilityGrantTypeId = core.capabilityGrant.values.id;
const shareGrantTypeId = core.shareGrant.values.id;
const nonAuthorityHiddenIdentityTypeIds = new Set([
  principalTypeId,
  authSubjectProjectionTypeId,
  principalRoleBindingTypeId,
  capabilityGrantTypeId,
  shareGrantTypeId,
]);
const activeCapabilityGrantStatusId = core.capabilityGrantStatus.values.active.id;
const principalCapabilityGrantTargetKindId = core.capabilityGrantTargetKind.values.principal.id;
const bearerCapabilityGrantTargetKindId = core.capabilityGrantTargetKind.values.bearer.id;
const predicateReadCapabilityGrantResourceKindId =
  core.capabilityGrantResourceKind.values.predicateRead.id;
const predicateWriteCapabilityGrantResourceKindId =
  core.capabilityGrantResourceKind.values.predicateWrite.id;
const commandExecuteCapabilityGrantResourceKindId =
  core.capabilityGrantResourceKind.values.commandExecute.id;
const shareSurfaceCapabilityGrantResourceKindId =
  core.capabilityGrantResourceKind.values.shareSurface.id;
const entityPredicateSliceShareSurfaceKindId = core.shareSurfaceKind.values.entityPredicateSlice.id;
const authorityRoleKey = "graph:authority";
const webAppAuthorityPolicyVersion = 0;

function getFirstObject(store: Store, subjectId: string, predicateId: string): string | undefined {
  return store.facts(subjectId, predicateId)[0]?.o;
}

function hasEntityOfType(store: Store, entityId: string, typeId: string): boolean {
  return store.facts(entityId, typePredicateId, typeId).length > 0;
}

function uniqueStrings(values: Iterable<string | undefined>): string[] {
  return [...new Set([...values].filter((value): value is string => typeof value === "string"))];
}

function readNonNegativeIntegerField(store: Store, subjectId: string, predicateId: string): number {
  const raw = getFirstObject(store, subjectId, predicateId);
  if (raw === undefined) {
    return 0;
  }

  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function readPrincipalCapabilityVersion(store: Store, principalId: string): number {
  return readNonNegativeIntegerField(store, principalId, principalCapabilityVersionPredicateId);
}

function readCapabilityGrantTargetPrincipalId(
  store: Store,
  capabilityGrantId: string,
): string | undefined {
  return getFirstObject(store, capabilityGrantId, capabilityGrantTargetKindPredicateId) ===
    principalCapabilityGrantTargetKindId
    ? getFirstObject(store, capabilityGrantId, capabilityGrantTargetPrincipalPredicateId)
    : undefined;
}

function readCapabilityGrantTargetKindId(
  store: Store,
  capabilityGrantId: string,
): string | undefined {
  return getFirstObject(store, capabilityGrantId, capabilityGrantTargetKindPredicateId);
}

function readResolvedAuthorizationCapabilityGrant(
  store: Store,
  capabilityGrantId: string,
): ResolvedAuthorizationCapabilityGrant | null {
  if (!hasEntityOfType(store, capabilityGrantId, capabilityGrantTypeId)) {
    return null;
  }

  const resourceKindId =
    getFirstObject(store, capabilityGrantId, capabilityGrantResourceKindPredicateId) ?? "";
  if (resourceKindId.length === 0) {
    return null;
  }

  return {
    id: capabilityGrantId,
    statusId: getFirstObject(store, capabilityGrantId, capabilityGrantStatusPredicateId),
    resourceKindId,
    resourcePredicateId: getFirstObject(
      store,
      capabilityGrantId,
      capabilityGrantResourcePredicateIdPredicateId,
    ),
    resourceCommandKey: getFirstObject(
      store,
      capabilityGrantId,
      capabilityGrantResourceCommandKeyPredicateId,
    ),
    resourceSurfaceId: getFirstObject(
      store,
      capabilityGrantId,
      capabilityGrantResourceSurfaceIdPredicateId,
    ),
    targetKindId: readCapabilityGrantTargetKindId(store, capabilityGrantId),
    constraintRootEntityId: getFirstObject(
      store,
      capabilityGrantId,
      capabilityGrantConstraintRootEntityIdPredicateId,
    ),
    constraintPredicateIds: uniqueStrings(
      store
        .facts(capabilityGrantId, capabilityGrantConstraintPredicateIdPredicateId)
        .map((edge) => edge.o),
    ),
    constraintExpiresAt: getFirstObject(
      store,
      capabilityGrantId,
      capabilityGrantConstraintExpiresAtPredicateId,
    ),
  };
}

function readActivePrincipalCapabilityGrantIds(
  store: Store,
  principalId: string,
): readonly string[] {
  return uniqueStrings(
    store
      .facts(undefined, capabilityGrantTargetPrincipalPredicateId, principalId)
      .map((edge) => edge.s)
      .filter(
        (capabilityGrantId) =>
          hasEntityOfType(store, capabilityGrantId, capabilityGrantTypeId) &&
          getFirstObject(store, capabilityGrantId, capabilityGrantStatusPredicateId) ===
            activeCapabilityGrantStatusId &&
          readCapabilityGrantTargetPrincipalId(store, capabilityGrantId) === principalId,
      ),
  ).sort();
}

function isBearerShareAuthorizationContext(authorization: AuthorizationContext): boolean {
  return authorization.principalId === null && authorization.principalKind === "anonymous";
}

export function readAuthorizationCapabilityGrants(
  store: Store,
  authorization: AuthorizationContext,
): readonly ResolvedAuthorizationCapabilityGrant[] {
  if (authorization.capabilityGrantIds.length === 0) {
    return [];
  }

  if (authorization.principalId) {
    const activeGrantIds = new Set(
      readActivePrincipalCapabilityGrantIds(store, authorization.principalId),
    );

    return uniqueStrings(authorization.capabilityGrantIds)
      .filter((capabilityGrantId) => activeGrantIds.has(capabilityGrantId))
      .map((capabilityGrantId) =>
        readResolvedAuthorizationCapabilityGrant(store, capabilityGrantId),
      )
      .filter((grant): grant is ResolvedAuthorizationCapabilityGrant => grant !== null);
  }

  if (!isBearerShareAuthorizationContext(authorization)) {
    return [];
  }

  return uniqueStrings(authorization.capabilityGrantIds)
    .map((capabilityGrantId) => readResolvedAuthorizationCapabilityGrant(store, capabilityGrantId))
    .filter((grant): grant is ResolvedAuthorizationCapabilityGrant => {
      return (
        grant !== null &&
        grant.statusId === activeCapabilityGrantStatusId &&
        grant.targetKindId === bearerCapabilityGrantTargetKindId &&
        grant.resourceKindId === shareSurfaceCapabilityGrantResourceKindId &&
        grant.constraintExpiresAt !== undefined &&
        !grantHasExpired(grant)
      );
    });
}

function grantHasExpired(grant: ResolvedAuthorizationCapabilityGrant): boolean {
  if (!grant.constraintExpiresAt) {
    return false;
  }

  const expiresAt = Date.parse(grant.constraintExpiresAt);
  return Number.isNaN(expiresAt) || expiresAt <= Date.now();
}

function readActiveCapabilityGrantShareGrantIds(
  store: Store,
  capabilityGrantId: string,
): readonly string[] {
  return uniqueStrings(
    store
      .facts(undefined, shareGrantCapabilityGrantPredicateId, capabilityGrantId)
      .map((edge) => edge.s)
      .filter(
        (shareGrantId) =>
          hasEntityOfType(store, shareGrantId, shareGrantTypeId) &&
          getFirstObject(store, shareGrantId, shareGrantStatusPredicateId) ===
            activeCapabilityGrantStatusId &&
          getFirstObject(store, shareGrantId, shareGrantCapabilityGrantPredicateId) ===
            capabilityGrantId,
      ),
  ).sort();
}

function readValidatedActiveShareGrants(
  store: Store,
  grant: ResolvedAuthorizationCapabilityGrant,
): ReadonlyArray<{
  readonly id: string;
  readonly rootEntityId: string;
  readonly predicateIds: readonly string[];
}> {
  const resourceSurfaceId = grant.resourceSurfaceId;
  if (
    grant.resourceKindId !== shareSurfaceCapabilityGrantResourceKindId ||
    resourceSurfaceId === undefined ||
    grant.constraintRootEntityId === undefined ||
    grant.constraintPredicateIds.length === 0
  ) {
    return [];
  }

  return readActiveCapabilityGrantShareGrantIds(store, grant.id).flatMap((shareGrantId) => {
    const surfaceKindId = getFirstObject(store, shareGrantId, shareGrantSurfaceKindPredicateId);
    const surfaceId = getFirstObject(store, shareGrantId, shareGrantSurfaceIdPredicateId);
    const rootEntityId = getFirstObject(
      store,
      shareGrantId,
      shareGrantSurfaceRootEntityIdPredicateId,
    );
    const predicateIds = uniqueStrings(
      store.facts(shareGrantId, shareGrantSurfacePredicateIdPredicateId).map((edge) => edge.o),
    );

    if (
      surfaceKindId !== entityPredicateSliceShareSurfaceKindId ||
      surfaceId === undefined ||
      rootEntityId === undefined
    ) {
      return [];
    }

    const validation = validateShareGrant(
      {
        id: shareGrantId,
        surface: {
          surfaceId,
          kind: "entity-predicate-slice",
          rootEntityId,
          predicateIds,
        },
        capabilityGrantId: grant.id,
        status: "active",
      },
      {
        id: grant.id,
        resource: {
          kind: "share-surface",
          surfaceId: resourceSurfaceId,
        },
        constraints: {
          rootEntityId: grant.constraintRootEntityId,
          predicateIds: grant.constraintPredicateIds,
          ...(grant.constraintExpiresAt === undefined
            ? {}
            : { expiresAt: grant.constraintExpiresAt }),
        },
        status: "active",
      },
    );

    return validation.ok
      ? [
          {
            id: shareGrantId,
            rootEntityId,
            predicateIds,
          },
        ]
      : [];
  });
}

function grantMatchesPredicateTarget(
  grant: ResolvedAuthorizationCapabilityGrant,
  resourceKindId: string,
  target: AuthorizationDecisionTarget,
): boolean {
  if (grant.resourceKindId !== resourceKindId || grantHasExpired(grant)) {
    return false;
  }
  if (grant.resourcePredicateId !== target.predicateId) {
    return false;
  }
  if (
    grant.constraintRootEntityId !== undefined &&
    grant.constraintRootEntityId !== target.subjectId
  ) {
    return false;
  }
  return (
    grant.constraintPredicateIds.length === 0 ||
    grant.constraintPredicateIds.includes(target.predicateId)
  );
}

function grantMatchesSharedPredicateTarget(
  store: Store,
  grant: ResolvedAuthorizationCapabilityGrant,
  target: AuthorizationDecisionTarget,
): boolean {
  const resourceSurfaceId = grant.resourceSurfaceId;
  if (
    grant.resourceKindId !== shareSurfaceCapabilityGrantResourceKindId ||
    grantHasExpired(grant) ||
    resourceSurfaceId === undefined ||
    grant.constraintRootEntityId === undefined ||
    grant.constraintPredicateIds.length === 0 ||
    target.policy?.shareable !== true ||
    target.policy.transportVisibility !== "replicated"
  ) {
    return false;
  }

  return readValidatedActiveShareGrants(store, grant).some(
    (shareGrant) =>
      shareGrant.rootEntityId === target.subjectId &&
      shareGrant.predicateIds.includes(target.predicateId),
  );
}

function grantMatchesCommand(
  grant: ResolvedAuthorizationCapabilityGrant,
  commandKey: string,
  touchedPredicates: readonly AuthorizationDecisionTarget[],
): boolean {
  if (
    grant.resourceKindId !== commandExecuteCapabilityGrantResourceKindId ||
    grantHasExpired(grant)
  ) {
    return false;
  }
  if (grant.resourceCommandKey !== commandKey) {
    return false;
  }
  if (
    grant.constraintRootEntityId !== undefined &&
    touchedPredicates.some((target) => target.subjectId !== grant.constraintRootEntityId)
  ) {
    return false;
  }
  return (
    grant.constraintPredicateIds.length === 0 ||
    touchedPredicates.every((target) => grant.constraintPredicateIds.includes(target.predicateId))
  );
}

function appendCapabilityKeys(
  target: Set<string>,
  capabilityKeys: readonly string[] | undefined,
): void {
  if (!capabilityKeys) {
    return;
  }
  for (const capabilityKey of capabilityKeys) {
    target.add(capabilityKey);
  }
}

export function createAuthorizationCapabilityResolver(
  store: Store,
  authorization: AuthorizationContext,
): AuthorizationCapabilityResolver {
  const grants = readAuthorizationCapabilityGrants(store, authorization);

  function resolvePredicateCapabilityKeys(
    resourceKindId: string,
    target: AuthorizationDecisionTarget,
  ): readonly string[] {
    const requiredCapabilities = target.policy?.requiredCapabilities;
    if (!requiredCapabilities || requiredCapabilities.length === 0) {
      return [];
    }

    return grants.some((grant) => grantMatchesPredicateTarget(grant, resourceKindId, target))
      ? [...requiredCapabilities]
      : [];
  }

  return {
    readKeysFor(target) {
      return resolvePredicateCapabilityKeys(predicateReadCapabilityGrantResourceKindId, target);
    },
    allowsSharedReadFor(target) {
      return grants.some((grant) => grantMatchesSharedPredicateTarget(store, grant, target));
    },
    writeKeysFor(target) {
      return resolvePredicateCapabilityKeys(predicateWriteCapabilityGrantResourceKindId, target);
    },
    commandKeysFor(input) {
      const capabilityKeys = new Set<string>();

      if (
        (input.commandPolicy.capabilities?.length ?? 0) > 0 &&
        grants.some((grant) =>
          grantMatchesCommand(grant, input.commandKey, input.touchedPredicates),
        )
      ) {
        appendCapabilityKeys(capabilityKeys, input.commandPolicy.capabilities);
      }

      for (const target of input.touchedPredicates) {
        appendCapabilityKeys(
          capabilityKeys,
          resolvePredicateCapabilityKeys(predicateWriteCapabilityGrantResourceKindId, target),
        );
      }

      return [...capabilityKeys];
    },
  };
}

export function assertCurrentPolicyVersion(
  authorization: AuthorizationContext,
): PolicyError | undefined {
  if (authorization.policyVersion === webAppAuthorityPolicyVersion) {
    return undefined;
  }

  return {
    code: "policy.stale_context",
    message: `Authorization context policy version "${authorization.policyVersion}" does not match authority policy version "${webAppAuthorityPolicyVersion}". Refresh the authorization context and retry.`,
    retryable: false,
    refreshRequired: true,
  };
}

export function assertCurrentCapabilityVersion(
  store: Store,
  authorization: AuthorizationContext,
): PolicyError | undefined {
  if (!authorization.principalId) {
    return undefined;
  }
  if (!hasEntityOfType(store, authorization.principalId, principalTypeId)) {
    return undefined;
  }

  const currentCapabilityVersion = readPrincipalCapabilityVersion(store, authorization.principalId);
  if (authorization.capabilityVersion === currentCapabilityVersion) {
    return undefined;
  }

  return {
    code: "policy.stale_context",
    message: `Authorization context capability version "${authorization.capabilityVersion}" does not match principal capability version "${currentCapabilityVersion}" for principal "${authorization.principalId}". Refresh the authorization context and retry.`,
    retryable: false,
    refreshRequired: true,
  };
}

export function assertCurrentAuthorizationVersion(
  store: Store,
  authorization: AuthorizationContext,
): PolicyError | undefined {
  return (
    assertCurrentPolicyVersion(authorization) ??
    assertCurrentCapabilityVersion(store, authorization)
  );
}

export function evaluateReadAuthorization(
  store: Store,
  authorization: AuthorizationContext,
  compiledFieldIndex: ReadonlyMap<string, CompiledFieldDefinition>,
  capabilityResolver: AuthorizationCapabilityResolver,
  subjectId: string,
  predicateId: string,
) {
  if (
    !authorizationHasAuthorityAccess(authorization) &&
    subjectIsHiddenIdentityEntity(store, subjectId)
  ) {
    return authorizeRead({
      authorization,
      target: {
        subjectId,
        predicateId,
        policy: {
          predicateId,
          transportVisibility: "authority-only",
          requiredWriteScope: "authority-only",
          readAudience: "authority",
          writeAudience: "authority",
          shareable: false,
        },
      },
    });
  }

  const target = createAuthorizationTarget(compiledFieldIndex, subjectId, predicateId);
  return authorizeRead({
    authorization,
    capabilityKeys: capabilityResolver.readKeysFor(target),
    sharedRead: capabilityResolver.allowsSharedReadFor(target),
    target,
  });
}

export function createReadableReplicationAuthorizer(input: {
  readonly store: Store;
  readonly authorization: AuthorizationContext;
  readonly compiledFieldIndex: ReadonlyMap<string, CompiledFieldDefinition>;
}): { readonly error?: PolicyError; readonly authorizeRead?: ReplicationReadAuthorizer } {
  const staleContextError = assertCurrentAuthorizationVersion(input.store, input.authorization);
  if (staleContextError) {
    return { error: staleContextError };
  }

  const capabilityResolver = createAuthorizationCapabilityResolver(
    input.store,
    input.authorization,
  );
  return {
    authorizeRead: ({ subjectId, predicateId }) =>
      evaluateReadAuthorization(
        input.store,
        input.authorization,
        input.compiledFieldIndex,
        capabilityResolver,
        subjectId,
        predicateId,
      ).allowed,
  };
}

export function filterReadableSnapshot(input: {
  readonly store: Store;
  readonly snapshot: StoreSnapshot;
  readonly authorization: AuthorizationContext;
  readonly compiledFieldIndex: ReadonlyMap<string, CompiledFieldDefinition>;
}): { readonly error?: PolicyError; readonly snapshot?: StoreSnapshot } {
  const readable = createReadableReplicationAuthorizer(input);
  if (!readable.authorizeRead) {
    return { error: readable.error };
  }

  const edges = input.snapshot.edges
    .filter((edge) =>
      readable.authorizeRead?.({
        subjectId: edge.s,
        predicateId: edge.p,
      }),
    )
    .map((edge) => ({ ...edge }));
  const visibleEdgeIds = new Set(edges.map((edge) => edge.id));

  return {
    snapshot: {
      edges,
      retracted: input.snapshot.retracted.filter((edgeId) => visibleEdgeIds.has(edgeId)),
    },
  };
}

export function assertWorkflowProjectionReadable(input: {
  readonly store: Store;
  readonly authorization: AuthorizationContext;
  readonly compiledFieldIndex: ReadonlyMap<string, CompiledFieldDefinition>;
  readonly subjectIds: readonly string[];
}): PolicyError | undefined {
  const staleContextError = assertCurrentAuthorizationVersion(input.store, input.authorization);
  if (staleContextError) {
    return staleContextError;
  }
  const capabilityResolver = createAuthorizationCapabilityResolver(
    input.store,
    input.authorization,
  );

  for (const subjectId of input.subjectIds) {
    for (const edge of input.store.facts(subjectId)) {
      const decision = evaluateReadAuthorization(
        input.store,
        input.authorization,
        input.compiledFieldIndex,
        capabilityResolver,
        subjectId,
        edge.p,
      );
      if (!decision.allowed) {
        return decision.error;
      }
    }
  }

  return undefined;
}

function createTransactionEdgeIndex(
  snapshot: StoreSnapshot,
): ReadonlyMap<string, StoreSnapshot["edges"][number]> {
  return new Map(snapshot.edges.map((edge) => [edge.id, edge]));
}

function resolveOperationTarget(
  operation: GraphWriteTransaction["ops"][number],
  edgeById: ReadonlyMap<string, StoreSnapshot["edges"][number]>,
):
  | {
      readonly subjectId: string;
      readonly predicateId: string;
    }
  | undefined {
  if (operation.op === "assert") {
    return {
      subjectId: operation.edge.s,
      predicateId: operation.edge.p,
    };
  }

  const edge = edgeById.get(operation.edgeId);
  if (!edge) return undefined;
  return {
    subjectId: edge.s,
    predicateId: edge.p,
  };
}

function resolveTransactionTargets(
  transaction: GraphWriteTransaction,
  snapshot: StoreSnapshot,
): ReadonlyArray<{
  readonly path: readonly string[];
  readonly subjectId: string;
  readonly predicateId: string;
}> {
  const edgeById = createTransactionEdgeIndex(snapshot);
  const targets: Array<{
    readonly path: readonly string[];
    readonly subjectId: string;
    readonly predicateId: string;
  }> = [];

  for (const [index, operation] of transaction.ops.entries()) {
    const target = resolveOperationTarget(operation, edgeById);
    if (!target) continue;
    targets.push({
      path: [`ops[${index}]`],
      subjectId: target.subjectId,
      predicateId: target.predicateId,
    });
  }

  return targets;
}

export function validateTransactionAuthorization(input: {
  readonly transaction: GraphWriteTransaction;
  readonly snapshot: StoreSnapshot;
  readonly authorization: AuthorizationContext;
  readonly writeScope: AuthoritativeWriteScope;
  readonly compiledFieldIndex: ReadonlyMap<string, CompiledFieldDefinition>;
  readonly buildValidationError: (
    issues: ReadonlyArray<{
      readonly code: string;
      readonly message: string;
      readonly path: readonly string[];
    }>,
  ) => GraphValidationError<GraphWriteTransaction>;
  readonly formatPolicyErrorMessage: (error: PolicyError) => string;
}): GraphValidationError<GraphWriteTransaction> | undefined {
  const store = createStore(input.snapshot);
  const policyVersionError = assertCurrentPolicyVersion(input.authorization);
  const capabilityVersionError = policyVersionError
    ? undefined
    : assertCurrentCapabilityVersion(store, input.authorization);
  const staleContextError = policyVersionError ?? capabilityVersionError;
  if (staleContextError) {
    return input.buildValidationError([
      {
        code: staleContextError.code,
        message: input.formatPolicyErrorMessage(staleContextError),
        path: ["authorization", capabilityVersionError ? "capabilityVersion" : "policyVersion"],
      },
    ]);
  }

  const capabilityResolver = createAuthorizationCapabilityResolver(store, input.authorization);
  const issues = resolveTransactionTargets(input.transaction, input.snapshot)
    .map((target) => {
      const authorizationTarget = createAuthorizationTarget(
        input.compiledFieldIndex,
        target.subjectId,
        target.predicateId,
      );
      const decision = authorizeWrite({
        authorization: input.authorization,
        capabilityKeys: capabilityResolver.writeKeysFor(authorizationTarget),
        target: authorizationTarget,
        writeScope: input.writeScope,
      });
      if (decision.allowed) {
        return undefined;
      }

      return {
        code: decision.error.code,
        message: input.formatPolicyErrorMessage(decision.error),
        path: target.path,
      };
    })
    .filter((issue): issue is NonNullable<typeof issue> => issue !== undefined);

  return issues.length > 0 ? input.buildValidationError(issues) : undefined;
}

function authorizationHasAuthorityAccess(authorization: AuthorizationContext): boolean {
  return (
    authorization.principalKind === "service" ||
    authorization.principalKind === "agent" ||
    authorization.roleKeys.includes(authorityRoleKey)
  );
}

function subjectIsHiddenIdentityEntity(store: Store, subjectId: string): boolean {
  return store
    .facts(subjectId, typePredicateId)
    .some((edge) => nonAuthorityHiddenIdentityTypeIds.has(edge.o));
}

export function buildWriteSecretFieldCommandTargets(
  input: {
    readonly entityId: string;
    readonly predicateId: string;
    readonly secretId: string;
  },
  compiledFieldIndex: ReadonlyMap<string, CompiledFieldDefinition>,
  secretHandleVersionPredicateId: string,
  secretHandleLastRotatedAtPredicateId: string,
): readonly AuthorizationDecisionTarget[] {
  return [
    createAuthorizationTarget(compiledFieldIndex, input.secretId, typePredicateId),
    createAuthorizationTarget(compiledFieldIndex, input.secretId, createdAtPredicateId),
    createAuthorizationTarget(compiledFieldIndex, input.secretId, namePredicateId),
    createAuthorizationTarget(compiledFieldIndex, input.secretId, updatedAtPredicateId),
    createAuthorizationTarget(compiledFieldIndex, input.secretId, secretHandleVersionPredicateId),
    createAuthorizationTarget(
      compiledFieldIndex,
      input.secretId,
      secretHandleLastRotatedAtPredicateId,
    ),
    createAuthorizationTarget(compiledFieldIndex, input.entityId, input.predicateId),
  ];
}

export function createWriteSecretFieldCommandPolicy(
  predicateId: string,
  writeSecretFieldCommandBasePredicateIds: readonly string[],
): GraphCommandPolicy {
  return {
    touchesPredicates: [
      ...writeSecretFieldCommandBasePredicateIds.map((touchedPredicateId) => ({
        predicateId: touchedPredicateId,
      })),
      { predicateId },
    ],
  };
}

export function evaluateCommandAuthorization(input: {
  readonly authorization: AuthorizationContext;
  readonly store: Store;
  readonly commandKey: string;
  readonly commandPolicy: GraphCommandPolicy;
  readonly touchedPredicates: readonly AuthorizationDecisionTarget[];
  readonly writeScope: AuthoritativeWriteScope;
}): { readonly error?: PolicyError } {
  const staleContextError = assertCurrentAuthorizationVersion(input.store, input.authorization);
  if (staleContextError) {
    return { error: staleContextError };
  }
  const capabilityResolver = createAuthorizationCapabilityResolver(
    input.store,
    input.authorization,
  );

  const decision = authorizeCommand({
    authorization: input.authorization,
    capabilityKeys: capabilityResolver.commandKeysFor({
      commandKey: input.commandKey,
      commandPolicy: input.commandPolicy,
      touchedPredicates: input.touchedPredicates,
    }),
    commandKey: input.commandKey,
    commandPolicy: input.commandPolicy,
    touchedPredicates: input.touchedPredicates,
    writeScope: input.writeScope,
  });
  return decision.allowed ? {} : { error: decision.error };
}
