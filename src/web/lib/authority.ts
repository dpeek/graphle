import {
  applyGraphWriteTransaction,
  type AuthSubjectRef,
  type AuthorizationContext,
  type AnyTypeOutput,
  type AuthoritativeGraphRetainedHistoryPolicy,
  createStore,
  createTypeClient,
  edgeId,
  GraphValidationError,
  isEntityType,
  type GraphWriteTransaction,
  type InvalidationEvent,
  type NamespaceClient,
  type PersistedAuthoritativeGraph,
  type PersistedAuthoritativeGraphStorageCommitInput,
  type PersistedAuthoritativeGraphStorageLoadResult,
  type PersistedAuthoritativeGraphStoragePersistInput,
  type PrincipalKind,
  type PolicyError,
  readPredicateValue as decodePredicateValue,
  type Store,
  type StoreSnapshot,
  validateShareGrant,
} from "@io/core/graph";
import { core } from "@io/core/graph/modules";
import { ops } from "@io/core/graph/modules/ops";
import {
  agentSession,
  createWorkflowReviewInvalidationEvent,
  repositoryBranch,
  repositoryCommit,
  workflowBranch,
  workflowCommit,
  workflowProject,
  workflowRepository,
  type CommitQueueScopeFailureCode,
  type CommitQueueScopeQuery,
  type CommitQueueScopeResult,
  type ProjectBranchScopeFailureCode,
  type ProjectBranchScopeQuery,
  type ProjectBranchScopeResult,
  type RetainedWorkflowProjectionState,
  WorkflowProjectionQueryError,
  workflowSchema,
  type WorkflowMutationAction,
  type WorkflowMutationResult,
} from "@io/core/graph/modules/ops/workflow";
import { pkm } from "@io/core/graph/modules/pkm";

import type {
  BearerShareLookupInput,
  BearerShareProjection,
  SessionPrincipalLookupInput,
  SessionPrincipalProjection,
} from "./auth-bridge.js";
import {
  type ResolvedAuthorizationCapabilityGrant,
  assertCurrentAuthorizationVersion,
  createAuthorizationCapabilityResolver,
  evaluateReadAuthorization,
  filterReadableSnapshot,
  validateTransactionAuthorization,
} from "./authority-authorization-services.js";
import {
  buildRetainedWorkflowProjectionState,
  createBootstrappedWebAuthority,
} from "./authority-bootstrap-services.js";
import {
  applyStagedWebAuthorityMutation,
  createWebAuthorityCommandServices,
} from "./authority-command-services.js";
import { getCompiledGraphArtifacts } from "./authority-compiled-fields.js";
import { createScopedSyncServices } from "./authority-scoped-sync-services.js";
import { collectTouchedTypeIdsForTransaction } from "./authority-sync-scope-planning.js";
import { seedExampleGraph } from "./example-data.js";
import { planRecordedMutation } from "./mutation-planning.js";
import { type WriteSecretFieldInput, type WriteSecretFieldResult } from "./secret-fields.js";
import type { WorkflowReviewLiveRegistrationTarget } from "./workflow-live-transport.js";

export { applyStagedWebAuthorityMutation } from "./authority-command-services.js";

const webAppGraph = { ...core, ...pkm, ...ops } as const;

type WebAppGraph = typeof webAppGraph;
type PersistedWebAppAuthority = PersistedAuthoritativeGraph<WebAppGraph>;
type WebAppAuthorityGraph = WebAppGraph & Record<string, AnyTypeOutput>;

export type WebAppAuthoritySecretRecord = {
  readonly value: string;
  readonly version: number;
  readonly storedAt?: string;
  readonly provider?: string;
  readonly fingerprint?: string;
  readonly externalKeyId?: string;
};

export type WebAppAuthoritySecretWrite = WebAppAuthoritySecretRecord & {
  readonly secretId: string;
};

export type WebAppAuthoritySecretLoadOptions = {
  readonly secretIds?: readonly string[];
};

export type WebAppAuthoritySecretInventoryRecord = {
  readonly version: number;
};

export type WebAppAuthoritySecretRepairInput = {
  readonly liveSecretIds: readonly string[];
};

export type WebAppAuthorityGraphSyncScopeRequest = {
  readonly kind?: "graph";
};

export type WebAppAuthorityModuleSyncScopeRequest = {
  readonly kind: "module";
  readonly moduleId: string;
  readonly scopeId: string;
};

export type WebAppAuthoritySyncScopeRequest =
  | WebAppAuthorityGraphSyncScopeRequest
  | WebAppAuthorityModuleSyncScopeRequest;

export type WriteSecretFieldWebAuthorityCommand = {
  readonly kind: "write-secret-field";
  readonly input: WriteSecretFieldInput;
};

export type WorkflowMutationWebAppAuthorityCommand = {
  readonly kind: "workflow-mutation";
  readonly input: WorkflowMutationAction;
};

export type WebAppAuthorityCommand =
  | WriteSecretFieldWebAuthorityCommand
  | WorkflowMutationWebAppAuthorityCommand;

type WebAppAuthorityCommandResultMap = {
  "write-secret-field": WriteSecretFieldResult;
  "workflow-mutation": WorkflowMutationResult;
};

export type WebAppAuthorityCommandResult<
  Kind extends WebAppAuthorityCommand["kind"] = WebAppAuthorityCommand["kind"],
> = WebAppAuthorityCommandResultMap[Kind];

export type WebAppAuthoritySessionPrincipalLookupOptions = {
  readonly allowRepair?: boolean;
};

/**
 * Consumer-owned `/api/commands` proof envelope.
 *
 * Branch 1 keeps the shared surface below this union at graph write
 * transactions, authoritative write scopes, sync payloads, and persisted
 * authority APIs.
 */
export type WebAuthorityCommand = WebAppAuthorityCommand;
export type WebAuthorityCommandResult<
  Kind extends WebAuthorityCommand["kind"] = WebAuthorityCommand["kind"],
> = WebAppAuthorityCommandResult<Kind>;

/**
 * Web authority storage adds secret side-storage to the shared graph/runtime
 * persisted-authority boundary. Only the adapted graph state contract should be
 * treated as stable across branches.
 */
export interface WebAppAuthorityStorage {
  load(): Promise<PersistedAuthoritativeGraphStorageLoadResult | null>;
  loadWorkflowProjection(): Promise<RetainedWorkflowProjectionState | null>;
  replaceWorkflowProjection(
    workflowProjection: RetainedWorkflowProjectionState | null,
  ): Promise<void>;
  inspectSecrets(): Promise<Record<string, WebAppAuthoritySecretInventoryRecord>>;
  /**
   * Load the currently live authority-only plaintext rows needed for the
   * current graph snapshot during bootstrap.
   */
  loadSecrets(
    options?: WebAppAuthoritySecretLoadOptions,
  ): Promise<Record<string, WebAppAuthoritySecretRecord>>;
  repairSecrets(input: WebAppAuthoritySecretRepairInput): Promise<void>;
  commit(
    input: PersistedAuthoritativeGraphStorageCommitInput,
    options?: {
      readonly secretWrite?: WebAppAuthoritySecretWrite;
      readonly workflowProjection?: RetainedWorkflowProjectionState;
    },
  ): Promise<void>;
  persist(
    input: PersistedAuthoritativeGraphStoragePersistInput,
    options?: {
      readonly workflowProjection?: RetainedWorkflowProjectionState;
    },
  ): Promise<void>;
}

type WebAppAuthoritySyncFreshness = NonNullable<
  Parameters<PersistedWebAppAuthority["createSyncPayload"]>[0]
>["freshness"];
type WebAppAuthorityWriteScope = NonNullable<
  Parameters<PersistedWebAppAuthority["applyTransaction"]>[1]
>["writeScope"];

export type WebAppAuthoritySyncOptions = {
  readonly authorization: AuthorizationContext;
  readonly freshness?: WebAppAuthoritySyncFreshness;
  readonly scope?: WebAppAuthoritySyncScopeRequest;
};

export type WebAppAuthorityReadOptions = {
  readonly authorization: AuthorizationContext;
};

export type WebAppAuthorityPredicateReadOptions = WebAppAuthorityReadOptions & {
  readonly strictRequired?: boolean;
};

export type WebAppAuthorityTransactionOptions = {
  readonly authorization: AuthorizationContext;
  readonly writeScope?: WebAppAuthorityWriteScope;
};

export type WebAppAuthoritySecretFieldOptions = {
  readonly authorization: AuthorizationContext;
};

export type WebAppAuthorityCommandOptions = {
  readonly authorization: AuthorizationContext;
};

export type WebAppAuthority = Omit<
  PersistedWebAppAuthority,
  "applyTransaction" | "createSyncPayload" | "getIncrementalSyncResult" | "graph" | "store"
> & {
  lookupBearerShare(input: BearerShareLookupInput): Promise<BearerShareProjection>;
  lookupSessionPrincipal(
    input: SessionPrincipalLookupInput,
    options?: WebAppAuthoritySessionPrincipalLookupOptions,
  ): Promise<SessionPrincipalProjection>;
  readSnapshot(options: WebAppAuthorityReadOptions): StoreSnapshot;
  readPredicateValue(
    subjectId: string,
    predicateId: string,
    options: WebAppAuthorityPredicateReadOptions,
  ): unknown;
  readProjectBranchScope(
    query: ProjectBranchScopeQuery,
    options: WebAppAuthorityReadOptions,
  ): ProjectBranchScopeResult;
  readCommitQueueScope(
    query: CommitQueueScopeQuery,
    options: WebAppAuthorityReadOptions,
  ): CommitQueueScopeResult;
  planWorkflowReviewLiveRegistration(
    cursor: string,
    options: WebAppAuthorityReadOptions,
  ): WorkflowReviewLiveRegistrationTarget;
  createSyncPayload(
    options: WebAppAuthoritySyncOptions,
  ): ReturnType<PersistedWebAppAuthority["createSyncPayload"]>;
  applyTransaction(
    transaction: GraphWriteTransaction,
    options: WebAppAuthorityTransactionOptions,
  ): ReturnType<PersistedWebAppAuthority["applyTransaction"]>;
  getIncrementalSyncResult(
    after: string | undefined,
    options: WebAppAuthoritySyncOptions,
  ): ReturnType<PersistedWebAppAuthority["getIncrementalSyncResult"]>;
  executeCommand<Command extends WebAppAuthorityCommand>(
    command: Command,
    options: WebAppAuthorityCommandOptions,
  ): Promise<WebAppAuthorityCommandResult<Command["kind"]>>;
  rebuildRetainedWorkflowProjection(): Promise<void>;
  writeSecretField(
    input: WriteSecretFieldInput,
    options: WebAppAuthoritySecretFieldOptions,
  ): Promise<WriteSecretFieldResult>;
};

export type WebAppAuthorityOptions = {
  readonly graph?: WebAppAuthorityGraph;
  readonly onWorkflowReviewInvalidation?: (invalidation: InvalidationEvent) => void;
  readonly retainedHistoryPolicy?: AuthoritativeGraphRetainedHistoryPolicy;
  readonly seedExampleGraph?: boolean;
};

const typePredicateId = edgeId(core.node.fields.type);
const namePredicateId = edgeId(core.node.fields.name);
const labelPredicateId = edgeId(core.node.fields.label);
const createdAtPredicateId = edgeId(core.node.fields.createdAt);
const updatedAtPredicateId = edgeId(core.node.fields.updatedAt);
const secretHandleVersionPredicateId = edgeId(core.secretHandle.fields.version);
const secretHandleLastRotatedAtPredicateId = edgeId(core.secretHandle.fields.lastRotatedAt);
const principalKindPredicateId = edgeId(core.principal.fields.kind);
const principalStatusPredicateId = edgeId(core.principal.fields.status);
const principalCapabilityVersionPredicateId = edgeId(core.principal.fields.capabilityVersion);
const graphWriteTransactionValidationKey = "$sync:tx";
const webAppGraphId = "graph:global";
const writeSecretFieldCommandKey = "write-secret-field";
const writeSecretFieldCommandBasePredicateIds = [
  typePredicateId,
  createdAtPredicateId,
  namePredicateId,
  updatedAtPredicateId,
  secretHandleVersionPredicateId,
  secretHandleLastRotatedAtPredicateId,
] as const;
const workflowModuleEntityTypeIds = new Set(
  Object.values(workflowSchema)
    .filter(isEntityType)
    .map((typeDef) => {
      const values = typeDef.values as { readonly id?: string; readonly key: string };
      return values.id ?? values.key;
    }),
);
const workflowProjectionReadEntityTypeIds = new Set(
  [
    workflowProject,
    workflowRepository,
    workflowBranch,
    workflowCommit,
    repositoryBranch,
    repositoryCommit,
    agentSession,
  ].map((typeDef) => {
    const values = typeDef.values as { readonly id?: string; readonly key: string };
    return values.id ?? values.key;
  }),
);
const principalHomeGraphIdPredicateId = edgeId(core.principal.fields.homeGraphId);
const authSubjectProjectionPrincipalPredicateId = edgeId(
  core.authSubjectProjection.fields.principal,
);
const authSubjectProjectionIssuerPredicateId = edgeId(core.authSubjectProjection.fields.issuer);
const authSubjectProjectionProviderPredicateId = edgeId(core.authSubjectProjection.fields.provider);
const authSubjectProjectionProviderAccountIdPredicateId = edgeId(
  core.authSubjectProjection.fields.providerAccountId,
);
const authSubjectProjectionAuthUserIdPredicateId = edgeId(
  core.authSubjectProjection.fields.authUserId,
);
const authSubjectProjectionStatusPredicateId = edgeId(core.authSubjectProjection.fields.status);
const principalRoleBindingPrincipalPredicateId = edgeId(core.principalRoleBinding.fields.principal);
const principalRoleBindingRoleKeyPredicateId = edgeId(core.principalRoleBinding.fields.roleKey);
const principalRoleBindingStatusPredicateId = edgeId(core.principalRoleBinding.fields.status);
const capabilityGrantResourceKindPredicateId = edgeId(core.capabilityGrant.fields.resourceKind);
const capabilityGrantResourcePredicateIdPredicateId = edgeId(
  core.capabilityGrant.fields.resourcePredicateId,
);
const capabilityGrantResourceCommandKeyPredicateId = edgeId(
  core.capabilityGrant.fields.resourceCommandKey,
);
const capabilityGrantResourcePermissionKeyPredicateId = edgeId(
  core.capabilityGrant.fields.resourcePermissionKey,
);
const capabilityGrantResourceSurfaceIdPredicateId = edgeId(
  core.capabilityGrant.fields.resourceSurfaceId,
);
const capabilityGrantTargetKindPredicateId = edgeId(core.capabilityGrant.fields.targetKind);
const capabilityGrantTargetPrincipalPredicateId = edgeId(
  core.capabilityGrant.fields.targetPrincipal,
);
const capabilityGrantTargetGraphIdPredicateId = edgeId(core.capabilityGrant.fields.targetGraphId);
const capabilityGrantBearerTokenHashPredicateId = edgeId(
  core.capabilityGrant.fields.bearerTokenHash,
);
const capabilityGrantGrantedByPrincipalPredicateId = edgeId(
  core.capabilityGrant.fields.grantedByPrincipal,
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
const capabilityGrantConstraintDelegatedFromGrantIdPredicateId = edgeId(
  core.capabilityGrant.fields.constraintDelegatedFromGrantId,
);
const capabilityGrantStatusPredicateId = edgeId(core.capabilityGrant.fields.status);
const capabilityGrantIssuedAtPredicateId = edgeId(core.capabilityGrant.fields.issuedAt);
const capabilityGrantRevokedAtPredicateId = edgeId(core.capabilityGrant.fields.revokedAt);
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
const activePrincipalStatusId = core.principalStatus.values.active.id;
const activeAuthSubjectStatusId = core.authSubjectStatus.values.active.id;
const activePrincipalRoleBindingStatusId = core.principalRoleBindingStatus.values.active.id;
const activeCapabilityGrantStatusId = core.capabilityGrantStatus.values.active.id;
const expiredCapabilityGrantStatusId = core.capabilityGrantStatus.values.expired.id;
const principalCapabilityGrantTargetKindId = core.capabilityGrantTargetKind.values.principal.id;
const bearerCapabilityGrantTargetKindId = core.capabilityGrantTargetKind.values.bearer.id;
const revokedCapabilityGrantStatusId = core.capabilityGrantStatus.values.revoked.id;
const shareSurfaceCapabilityGrantResourceKindId =
  core.capabilityGrantResourceKind.values.shareSurface.id;
const entityPredicateSliceShareSurfaceKindId = core.shareSurfaceKind.values.entityPredicateSlice.id;
const shareGrantVisibilityTriggerPredicateIds = new Set([
  typePredicateId,
  shareGrantSurfaceIdPredicateId,
  shareGrantSurfaceKindPredicateId,
  shareGrantSurfaceRootEntityIdPredicateId,
  shareGrantSurfacePredicateIdPredicateId,
  shareGrantCapabilityGrantPredicateId,
  shareGrantStatusPredicateId,
]);
const capabilityVersionTriggerPredicateIds = new Set([
  typePredicateId,
  principalRoleBindingPrincipalPredicateId,
  principalRoleBindingRoleKeyPredicateId,
  principalRoleBindingStatusPredicateId,
  capabilityGrantResourceKindPredicateId,
  capabilityGrantResourcePredicateIdPredicateId,
  capabilityGrantResourceCommandKeyPredicateId,
  capabilityGrantResourcePermissionKeyPredicateId,
  capabilityGrantResourceSurfaceIdPredicateId,
  capabilityGrantTargetKindPredicateId,
  capabilityGrantTargetPrincipalPredicateId,
  capabilityGrantTargetGraphIdPredicateId,
  capabilityGrantBearerTokenHashPredicateId,
  capabilityGrantGrantedByPrincipalPredicateId,
  capabilityGrantConstraintRootEntityIdPredicateId,
  capabilityGrantConstraintPredicateIdPredicateId,
  capabilityGrantConstraintExpiresAtPredicateId,
  capabilityGrantConstraintDelegatedFromGrantIdPredicateId,
  capabilityGrantStatusPredicateId,
  capabilityGrantIssuedAtPredicateId,
  capabilityGrantRevokedAtPredicateId,
]);
const principalKindById = new Map<string, PrincipalKind>([
  [core.principalKind.values.human.id, "human"],
  [core.principalKind.values.service.id, "service"],
  [core.principalKind.values.agent.id, "agent"],
  [core.principalKind.values.anonymous.id, "anonymous"],
  [core.principalKind.values.remoteGraph.id, "remoteGraph"],
]);

let authorityCursorEpoch = 0;

function createAuthorityCursorPrefix(): string {
  authorityCursorEpoch = Math.max(authorityCursorEpoch + 1, Date.now());
  return `web-authority:${authorityCursorEpoch}:`;
}

function clonePersistedValue<T>(value: T): T {
  return structuredClone(value);
}

function formatPolicyErrorMessage(error: PolicyError): string {
  return `${error.code}: ${error.message}`;
}

class WebAppAuthorityMutationError extends Error {
  readonly status: number;
  readonly code?: PolicyError["code"];
  readonly retryable?: boolean;
  readonly refreshRequired?: boolean;

  constructor(
    status: number,
    message: string,
    options: Partial<Pick<PolicyError, "code" | "retryable" | "refreshRequired">> = {},
  ) {
    super(message);
    this.name = "WebAppAuthorityMutationError";
    this.status = status;
    this.code = options.code;
    this.retryable = options.retryable;
    this.refreshRequired = options.refreshRequired;
  }
}

type WebAppAuthoritySecretVersionMismatch = {
  readonly graphVersion: number;
  readonly secretId: string;
  readonly storedVersion: number;
};

type WebAppAuthoritySecretStartupDrift = {
  readonly invalidSecretIds: readonly string[];
  readonly liveSecretIds: readonly string[];
  readonly missingSecretIds: readonly string[];
  readonly orphanedSecretIds: readonly string[];
  readonly versionMismatches: readonly WebAppAuthoritySecretVersionMismatch[];
};

function hasBlockingSecretStartupDrift(drift: WebAppAuthoritySecretStartupDrift): boolean {
  return (
    drift.invalidSecretIds.length > 0 ||
    drift.missingSecretIds.length > 0 ||
    drift.versionMismatches.length > 0
  );
}

function formatSecretStartupDriftMessage(drift: WebAppAuthoritySecretStartupDrift): string {
  const details: string[] = [];
  if (drift.invalidSecretIds.length > 0) {
    details.push(`missing graph metadata for ${drift.invalidSecretIds.join(", ")}`);
  }
  if (drift.missingSecretIds.length > 0) {
    details.push(`missing plaintext rows for ${drift.missingSecretIds.join(", ")}`);
  }
  if (drift.versionMismatches.length > 0) {
    details.push(
      `version mismatch for ${drift.versionMismatches
        .map(
          ({ secretId, graphVersion, storedVersion }) =>
            `${secretId} (graph ${graphVersion}, stored ${storedVersion})`,
        )
        .join(", ")}`,
    );
  }

  const blockingSummary = details.length > 0 ? `: ${details.join("; ")}` : ".";
  const orphanedSummary =
    drift.orphanedSecretIds.length > 0
      ? ` Unreferenced side-storage rows for ${drift.orphanedSecretIds.join(", ")} were left untouched because startup repair stopped at the blocking drift.`
      : "";

  return `Cannot start web authority because secret storage drift was detected${blockingSummary}.${orphanedSummary}`;
}

class WebAppAuthoritySecretStorageDriftError extends Error {
  readonly invalidSecretIds: readonly string[];
  readonly liveSecretIds: readonly string[];
  readonly missingSecretIds: readonly string[];
  readonly orphanedSecretIds: readonly string[];
  readonly versionMismatches: readonly WebAppAuthoritySecretVersionMismatch[];

  constructor(drift: WebAppAuthoritySecretStartupDrift) {
    super(formatSecretStartupDriftMessage(drift));
    this.name = "WebAppAuthoritySecretStorageDriftError";
    this.invalidSecretIds = drift.invalidSecretIds;
    this.liveSecretIds = drift.liveSecretIds;
    this.missingSecretIds = drift.missingSecretIds;
    this.orphanedSecretIds = drift.orphanedSecretIds;
    this.versionMismatches = drift.versionMismatches;
  }
}

function buildTransactionValidationError(
  transaction: GraphWriteTransaction,
  issues: ReadonlyArray<{
    readonly code: string;
    readonly message: string;
    readonly path: readonly string[];
  }>,
): GraphValidationError<GraphWriteTransaction> {
  return new GraphValidationError({
    ok: false,
    phase: "authoritative",
    event: "reconcile",
    value: transaction,
    changedPredicateKeys: issues.length > 0 ? [graphWriteTransactionValidationKey] : [],
    issues: issues.map((issue) => ({
      source: "runtime" as const,
      code: issue.code,
      message: issue.message,
      path: Object.freeze([...issue.path]),
      predicateKey: graphWriteTransactionValidationKey,
      nodeId: graphWriteTransactionValidationKey,
    })),
  });
}

function resolveCommandErrorStatus(error: PolicyError): number {
  switch (error.code) {
    case "auth.unauthenticated":
      return 401;
    case "policy.stale_context":
      return 409;
    default:
      return 403;
  }
}

function resolveReadErrorStatus(error: PolicyError): number {
  return resolveCommandErrorStatus(error);
}

function createCommandPolicyError(error: PolicyError): WebAppAuthorityMutationError {
  return new WebAppAuthorityMutationError(
    resolveCommandErrorStatus(error),
    formatPolicyErrorMessage(error),
    {
      code: error.code,
      retryable: error.retryable,
      refreshRequired: error.refreshRequired,
    },
  );
}

class WebAppAuthorityReadError extends Error {
  readonly status: number;
  readonly code?: PolicyError["code"];
  readonly retryable?: boolean;
  readonly refreshRequired?: boolean;

  constructor(
    status: number,
    message: string,
    options: Partial<Pick<PolicyError, "code" | "retryable" | "refreshRequired">> = {},
  ) {
    super(message);
    this.name = "WebAppAuthorityReadError";
    this.status = status;
    this.code = options.code;
    this.retryable = options.retryable;
    this.refreshRequired = options.refreshRequired;
  }
}

function createReadPolicyError(error: PolicyError): WebAppAuthorityReadError {
  return new WebAppAuthorityReadError(
    resolveReadErrorStatus(error),
    formatPolicyErrorMessage(error),
    {
      code: error.code,
      retryable: error.retryable,
      refreshRequired: error.refreshRequired,
    },
  );
}

type WorkflowProjectionReadFailureCode =
  | ProjectBranchScopeFailureCode
  | CommitQueueScopeFailureCode;

function resolveWorkflowProjectionReadStatus(code: WorkflowProjectionReadFailureCode): number {
  switch (code) {
    case "project-not-found":
    case "branch-not-found":
      return 404;
    case "projection-stale":
      return 409;
    case "policy-denied":
      return 403;
  }
}

export class WebAppAuthorityWorkflowReadError extends Error {
  readonly status: number;
  readonly code: WorkflowProjectionReadFailureCode;
  readonly retryable?: boolean;
  readonly refreshRequired?: boolean;

  constructor(
    status: number,
    code: WorkflowProjectionReadFailureCode,
    message: string,
    options: Partial<Pick<PolicyError, "retryable" | "refreshRequired">> = {},
  ) {
    super(message);
    this.name = "WebAppAuthorityWorkflowReadError";
    this.status = status;
    this.code = code;
    this.retryable = options.retryable;
    this.refreshRequired = options.refreshRequired;
  }
}

function createWorkflowProjectionPolicyError(error: PolicyError): WebAppAuthorityWorkflowReadError {
  return new WebAppAuthorityWorkflowReadError(
    resolveReadErrorStatus(error),
    "policy-denied",
    formatPolicyErrorMessage(error),
    {
      retryable: error.retryable,
      refreshRequired: error.refreshRequired,
    },
  );
}

function throwWorkflowProjectionReadError(error: unknown): never {
  if (error instanceof WorkflowProjectionQueryError) {
    throw new WebAppAuthorityWorkflowReadError(
      resolveWorkflowProjectionReadStatus(error.code),
      error.code,
      error.message,
    );
  }

  throw error;
}

type WorkflowLiveScopeFailureCode = "auth.unauthenticated" | "policy-changed" | "scope-changed";

export class WebAppAuthorityWorkflowLiveScopeError extends Error {
  readonly status: number;
  readonly code?: WorkflowLiveScopeFailureCode;

  constructor(status: number, message: string, code?: WorkflowLiveScopeFailureCode) {
    super(message);
    this.name = "WebAppAuthorityWorkflowLiveScopeError";
    this.status = status;
    this.code = code;
  }
}

export class WebAppAuthoritySessionPrincipalLookupError extends Error {
  readonly status: number;
  readonly code = "auth.principal_missing" as const;
  readonly reason: "conflict" | "missing";

  constructor(status: number, reason: "conflict" | "missing", message: string) {
    super(message);
    this.name = "WebAppAuthoritySessionPrincipalLookupError";
    this.status = status;
    this.reason = reason;
  }
}

export class WebAppAuthorityBearerShareLookupError extends Error {
  readonly status: number;
  readonly code = "grant.invalid" as const;
  readonly reason: "conflict" | "expired" | "missing" | "revoked";

  constructor(
    status: number,
    reason: "conflict" | "expired" | "missing" | "revoked",
    message: string,
  ) {
    super(message);
    this.name = "WebAppAuthorityBearerShareLookupError";
    this.status = status;
    this.reason = reason;
  }
}
function getFirstObject(store: Store, subjectId: string, predicateId: string): string | undefined {
  return store.facts(subjectId, predicateId)[0]?.o;
}

function getEntityLabel(store: Store, id: string): string {
  return (
    getFirstObject(store, id, namePredicateId) ?? getFirstObject(store, id, labelPredicateId) ?? id
  );
}

export function collectLiveSecretIds(snapshot: StoreSnapshot): readonly string[] {
  const retractedEdgeIds = new Set(snapshot.retracted);
  const secretHandleIds = new Set<string>();

  for (const edge of snapshot.edges) {
    if (retractedEdgeIds.has(edge.id)) continue;
    if (edge.p === typePredicateId && edge.o === core.secretHandle.values.id) {
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

function readAuthorizationCapabilityGrants(
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

function readCapabilityGrantShareGrantIds(
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
          getFirstObject(store, shareGrantId, shareGrantCapabilityGrantPredicateId) ===
            capabilityGrantId,
      ),
  ).sort();
}

function readBearerShareProjection(
  store: Store,
  input: BearerShareLookupInput,
): BearerShareProjection {
  const matchingGrantIds = uniqueStrings(
    store
      .facts(undefined, capabilityGrantBearerTokenHashPredicateId, input.tokenHash)
      .map((edge) => edge.s)
      .filter(
        (capabilityGrantId) =>
          hasEntityOfType(store, capabilityGrantId, capabilityGrantTypeId) &&
          readCapabilityGrantTargetKindId(store, capabilityGrantId) ===
            bearerCapabilityGrantTargetKindId,
      ),
  ).sort();

  if (matchingGrantIds.length === 0) {
    createMissingBearerShareLookupError(input);
  }

  const matchingGrants = matchingGrantIds
    .map((capabilityGrantId) => readResolvedAuthorizationCapabilityGrant(store, capabilityGrantId))
    .filter((grant): grant is ResolvedAuthorizationCapabilityGrant => grant !== null);
  const activeEligibleGrants = matchingGrants.filter(
    (grant) =>
      grant.statusId === activeCapabilityGrantStatusId &&
      grant.targetKindId === bearerCapabilityGrantTargetKindId &&
      grant.resourceKindId === shareSurfaceCapabilityGrantResourceKindId &&
      grant.constraintExpiresAt !== undefined &&
      !grantHasExpired(grant) &&
      readValidatedActiveShareGrants(store, grant).length > 0,
  );

  if (activeEligibleGrants.length > 1) {
    createConflictingBearerShareLookupError(
      input,
      activeEligibleGrants.map((grant) => grant.id),
    );
  }

  const activeEligibleGrant = activeEligibleGrants[0];
  if (activeEligibleGrant) {
    return {
      capabilityGrantIds: [activeEligibleGrant.id],
    };
  }

  if (
    matchingGrants.some(
      (grant) =>
        grant.statusId === expiredCapabilityGrantStatusId ||
        (grant.statusId === activeCapabilityGrantStatusId && grantHasExpired(grant)),
    ) ||
    matchingGrants.some((grant) =>
      readCapabilityGrantShareGrantIds(store, grant.id).some(
        (shareGrantId) =>
          getFirstObject(store, shareGrantId, shareGrantStatusPredicateId) ===
          expiredCapabilityGrantStatusId,
      ),
    )
  ) {
    createExpiredBearerShareLookupError(input);
  }

  if (
    matchingGrants.some((grant) => grant.statusId === revokedCapabilityGrantStatusId) ||
    matchingGrants.some((grant) =>
      readCapabilityGrantShareGrantIds(store, grant.id).some(
        (shareGrantId) =>
          getFirstObject(store, shareGrantId, shareGrantStatusPredicateId) ===
          revokedCapabilityGrantStatusId,
      ),
    ) ||
    matchingGrants.some(
      (grant) =>
        readCapabilityGrantShareGrantIds(store, grant.id).length > 0 &&
        readValidatedActiveShareGrants(store, grant).length === 0,
    )
  ) {
    createRevokedBearerShareLookupError(input);
  }

  createMissingBearerShareLookupError(input);
}

function matchesAuthSubjectProjection(
  store: Store,
  projectionId: string,
  subject: AuthSubjectRef,
): boolean {
  return (
    getFirstObject(store, projectionId, authSubjectProjectionIssuerPredicateId) ===
      subject.issuer &&
    getFirstObject(store, projectionId, authSubjectProjectionProviderPredicateId) ===
      subject.provider &&
    getFirstObject(store, projectionId, authSubjectProjectionProviderAccountIdPredicateId) ===
      subject.providerAccountId &&
    getFirstObject(store, projectionId, authSubjectProjectionAuthUserIdPredicateId) ===
      subject.authUserId
  );
}

function listActiveAuthSubjectProjectionIds(store: Store, subject: AuthSubjectRef): string[] {
  return uniqueStrings(
    store
      .facts(undefined, authSubjectProjectionIssuerPredicateId, subject.issuer)
      .map((edge) => edge.s)
      .filter(
        (projectionId) =>
          hasEntityOfType(store, projectionId, authSubjectProjectionTypeId) &&
          getFirstObject(store, projectionId, authSubjectProjectionStatusPredicateId) ===
            activeAuthSubjectStatusId &&
          matchesAuthSubjectProjection(store, projectionId, subject),
      ),
  );
}

function listActiveAuthUserProjectionIds(store: Store, authUserId: string): string[] {
  return uniqueStrings(
    store
      .facts(undefined, authSubjectProjectionAuthUserIdPredicateId, authUserId)
      .map((edge) => edge.s)
      .filter(
        (projectionId) =>
          hasEntityOfType(store, projectionId, authSubjectProjectionTypeId) &&
          getFirstObject(store, projectionId, authSubjectProjectionStatusPredicateId) ===
            activeAuthSubjectStatusId,
      ),
  );
}

function readPrincipalRoleKeys(store: Store, principalId: string): readonly string[] {
  return uniqueStrings(
    store
      .facts(undefined, principalRoleBindingPrincipalPredicateId, principalId)
      .map((edge) => edge.s)
      .filter(
        (bindingId) =>
          hasEntityOfType(store, bindingId, principalRoleBindingTypeId) &&
          getFirstObject(store, bindingId, principalRoleBindingStatusPredicateId) ===
            activePrincipalRoleBindingStatusId,
      )
      .map((bindingId) => getFirstObject(store, bindingId, principalRoleBindingRoleKeyPredicateId)),
  ).sort();
}

function readSessionPrincipalProjection(
  store: Store,
  principalId: string,
  graphId: string,
): SessionPrincipalProjection | null {
  if (!hasEntityOfType(store, principalId, principalTypeId)) return null;
  if (getFirstObject(store, principalId, principalStatusPredicateId) !== activePrincipalStatusId) {
    return null;
  }
  if (getFirstObject(store, principalId, principalHomeGraphIdPredicateId) !== graphId) {
    return null;
  }

  const principalKindId = getFirstObject(store, principalId, principalKindPredicateId);
  const principalKind = principalKindId ? principalKindById.get(principalKindId) : undefined;
  if (!principalKind) return null;

  return {
    principalId,
    principalKind,
    roleKeys: readPrincipalRoleKeys(store, principalId),
    capabilityGrantIds: readActivePrincipalCapabilityGrantIds(store, principalId),
    capabilityVersion: readPrincipalCapabilityVersion(store, principalId),
  };
}

function readProjectionSessionPrincipalProjection(
  store: Store,
  projectionId: string,
  graphId: string,
): SessionPrincipalProjection | null {
  const principalId = getFirstObject(
    store,
    projectionId,
    authSubjectProjectionPrincipalPredicateId,
  );
  return principalId ? readSessionPrincipalProjection(store, principalId, graphId) : null;
}

function readAuthUserPrincipalIds(store: Store, graphId: string, authUserId: string): string[] {
  return uniqueStrings(
    listActiveAuthUserProjectionIds(store, authUserId)
      .map((projectionId) =>
        getFirstObject(store, projectionId, authSubjectProjectionPrincipalPredicateId),
      )
      .filter((principalId): principalId is string => {
        if (!principalId) return false;
        return readSessionPrincipalProjection(store, principalId, graphId) !== null;
      }),
  );
}

function principalNeedsHomeGraphRepair(store: Store, principalId: string): boolean {
  return !store
    .facts(principalId, principalHomeGraphIdPredicateId)
    .some((edge) => typeof edge.o === "string" && edge.o.trim().length > 0);
}

function listPrincipalIdsMissingHomeGraphId(store: Store): string[] {
  return uniqueStrings(
    store
      .facts(undefined, typePredicateId, principalTypeId)
      .map((edge) => edge.s)
      .filter((principalId) => principalNeedsHomeGraphRepair(store, principalId)),
  );
}

async function repairLegacyPrincipalHomeGraphIds(
  authority: PersistedWebAppAuthority,
): Promise<void> {
  const principalIdsToRepair = listPrincipalIdsMissingHomeGraphId(authority.store);
  if (principalIdsToRepair.length === 0) return;

  const repaired = planAuthorityMutation(
    authority.store.snapshot(),
    `repair:principal-home-graph-id:${Date.now()}`,
    (_mutationGraph, mutationStore) => {
      for (const principalId of principalIdsToRepair) {
        setSingleReferenceField(
          mutationStore,
          principalId,
          principalHomeGraphIdPredicateId,
          webAppGraphId,
        );
      }

      return principalIdsToRepair;
    },
  );

  if (!repaired.changed) return;

  await authority.applyTransaction(repaired.transaction, {
    writeScope: "authority-only",
  });
}

function authSubjectLookupLabel(subject: AuthSubjectRef): string {
  return `${subject.issuer}:${subject.provider}:${subject.providerAccountId}`;
}

function buildAuthSubjectProjectionName(subject: AuthSubjectRef): string {
  return `Auth subject ${authSubjectLookupLabel(subject)}`;
}

function buildPrincipalName(subject: AuthSubjectRef): string {
  return `Principal ${subject.authUserId}`;
}

function createMissingSessionPrincipalLookupError(input: SessionPrincipalLookupInput): never {
  throw new WebAppAuthoritySessionPrincipalLookupError(
    404,
    "missing",
    `No graph principal projection exists for subject "${authSubjectLookupLabel(input.subject)}" in graph "${input.graphId}".`,
  );
}

function createConflictingSessionPrincipalLookupError(
  input: SessionPrincipalLookupInput,
  principalIds: readonly string[],
): never {
  throw new WebAppAuthoritySessionPrincipalLookupError(
    409,
    "conflict",
    `Multiple active graph principals (${principalIds.join(", ")}) are linked to Better Auth user "${input.subject.authUserId}" in graph "${input.graphId}".`,
  );
}

function createConflictingAuthSubjectProjectionError(
  input: SessionPrincipalLookupInput,
  projectionIds: readonly string[],
): never {
  throw new WebAppAuthoritySessionPrincipalLookupError(
    409,
    "conflict",
    `Multiple active auth subject projections (${projectionIds.join(", ")}) exist for subject "${authSubjectLookupLabel(input.subject)}" in graph "${input.graphId}".`,
  );
}

function createMissingBearerShareLookupError(input: BearerShareLookupInput): never {
  throw new WebAppAuthorityBearerShareLookupError(
    404,
    "missing",
    `No active bearer share grant exists for token hash "${input.tokenHash}" in graph "${input.graphId}".`,
  );
}

function createExpiredBearerShareLookupError(input: BearerShareLookupInput): never {
  throw new WebAppAuthorityBearerShareLookupError(
    403,
    "expired",
    `Bearer share token "${input.tokenHash}" has expired in graph "${input.graphId}".`,
  );
}

function createRevokedBearerShareLookupError(input: BearerShareLookupInput): never {
  throw new WebAppAuthorityBearerShareLookupError(
    403,
    "revoked",
    `Bearer share token "${input.tokenHash}" has been revoked in graph "${input.graphId}".`,
  );
}

function createConflictingBearerShareLookupError(
  input: BearerShareLookupInput,
  capabilityGrantIds: readonly string[],
): never {
  throw new WebAppAuthorityBearerShareLookupError(
    409,
    "conflict",
    `Multiple active bearer share grants (${capabilityGrantIds.join(", ")}) matched token hash "${input.tokenHash}" in graph "${input.graphId}".`,
  );
}

function setSingleReferenceField(
  store: Store,
  subjectId: string,
  predicateId: string,
  objectId: string,
): void {
  const current = store.facts(subjectId, predicateId);
  if (current.length === 1 && current[0]?.o === objectId) return;

  store.batch(() => {
    for (const edge of current) {
      store.retract(edge.id);
    }
    store.assert(subjectId, predicateId, objectId);
  });
}

function resolveRoleBindingPrincipalIds(
  store: Store,
  principalRoleBindingId: string,
): readonly string[] {
  return uniqueStrings([
    getFirstObject(store, principalRoleBindingId, principalRoleBindingPrincipalPredicateId),
  ]);
}

function resolveCapabilityGrantPrincipalIds(
  store: Store,
  capabilityGrantId: string,
): readonly string[] {
  return uniqueStrings([readCapabilityGrantTargetPrincipalId(store, capabilityGrantId)]);
}

function resolveShareGrantPrincipalIds(store: Store, shareGrantId: string): readonly string[] {
  const capabilityGrantId = getFirstObject(
    store,
    shareGrantId,
    shareGrantCapabilityGrantPredicateId,
  );
  if (!capabilityGrantId) {
    return [];
  }

  return resolveCapabilityGrantPrincipalIds(store, capabilityGrantId);
}

function readShareGrantCapabilityGrantId(store: Store, shareGrantId: string): string | undefined {
  return getFirstObject(store, shareGrantId, shareGrantCapabilityGrantPredicateId);
}

function resolveCapabilityVersionAffectedPrincipalIds(
  beforeStore: Store,
  afterStore: Store,
  transaction: GraphWriteTransaction,
  snapshot: StoreSnapshot,
): readonly string[] {
  const touchedPredicatesBySubject = new Map<string, Set<string>>();
  const edgeById = createTransactionEdgeIndex(snapshot);

  for (const operation of transaction.ops) {
    const predicateId =
      operation.op === "assert" ? operation.edge.p : edgeById.get(operation.edgeId)?.p;
    const subjectId =
      operation.op === "assert" ? operation.edge.s : edgeById.get(operation.edgeId)?.s;
    if (!predicateId || !subjectId || !capabilityVersionTriggerPredicateIds.has(predicateId)) {
      continue;
    }

    const predicates = touchedPredicatesBySubject.get(subjectId);
    if (predicates) {
      predicates.add(predicateId);
      continue;
    }
    touchedPredicatesBySubject.set(subjectId, new Set([predicateId]));
  }

  const affectedPrincipalIds = new Set<string>();
  for (const subjectId of touchedPredicatesBySubject.keys()) {
    if (
      hasEntityOfType(beforeStore, subjectId, principalRoleBindingTypeId) ||
      hasEntityOfType(afterStore, subjectId, principalRoleBindingTypeId)
    ) {
      for (const principalId of resolveRoleBindingPrincipalIds(beforeStore, subjectId)) {
        affectedPrincipalIds.add(principalId);
      }
      for (const principalId of resolveRoleBindingPrincipalIds(afterStore, subjectId)) {
        affectedPrincipalIds.add(principalId);
      }
    }

    if (
      hasEntityOfType(beforeStore, subjectId, capabilityGrantTypeId) ||
      hasEntityOfType(afterStore, subjectId, capabilityGrantTypeId)
    ) {
      for (const principalId of resolveCapabilityGrantPrincipalIds(beforeStore, subjectId)) {
        affectedPrincipalIds.add(principalId);
      }
      for (const principalId of resolveCapabilityGrantPrincipalIds(afterStore, subjectId)) {
        affectedPrincipalIds.add(principalId);
      }
    }
  }

  return [...affectedPrincipalIds].sort();
}

function planCapabilityVersionInvalidationTransaction(
  snapshot: StoreSnapshot,
  transaction: GraphWriteTransaction,
): GraphWriteTransaction {
  if (transaction.ops.length === 0) {
    return transaction;
  }

  const beforeStore = createStore(snapshot);
  const afterStore = createStore(snapshot);
  applyGraphWriteTransaction(afterStore, transaction);

  const affectedPrincipalIds = resolveCapabilityVersionAffectedPrincipalIds(
    beforeStore,
    afterStore,
    transaction,
    snapshot,
  );
  if (affectedPrincipalIds.length === 0) {
    return transaction;
  }

  const affectedPrincipalIdSet = new Set(affectedPrincipalIds);
  const edgeById = createTransactionEdgeIndex(snapshot);
  const filteredTransaction = {
    ...transaction,
    ops: transaction.ops.filter((operation) => {
      if (operation.op === "assert") {
        return !(
          operation.edge.p === principalCapabilityVersionPredicateId &&
          affectedPrincipalIdSet.has(operation.edge.s)
        );
      }

      const edge = edgeById.get(operation.edgeId);
      return !(
        edge?.p === principalCapabilityVersionPredicateId && affectedPrincipalIdSet.has(edge.s)
      );
    }),
  };

  return planRecordedMutation(
    snapshot,
    webAppGraph,
    transaction.id,
    (_mutationGraph, mutationStore) => {
      applyGraphWriteTransaction(mutationStore, filteredTransaction);

      for (const principalId of affectedPrincipalIds) {
        if (!hasEntityOfType(mutationStore, principalId, principalTypeId)) {
          continue;
        }

        setSingleReferenceField(
          mutationStore,
          principalId,
          principalCapabilityVersionPredicateId,
          String(readPrincipalCapabilityVersion(mutationStore, principalId) + 1),
        );
      }
    },
  ).transaction;
}

function planAuthorityMutation<TResult>(
  snapshot: StoreSnapshot,
  txId: string,
  mutate: (graph: NamespaceClient<WebAppGraph>, store: Store) => TResult,
): {
  readonly changed: boolean;
  readonly result: TResult;
  readonly transaction: GraphWriteTransaction;
} {
  return planRecordedMutation(snapshot, webAppGraph, txId, mutate);
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

function changesRequireVisibilityReset(
  store: Store,
  snapshot: StoreSnapshot,
  changes: ReturnType<PersistedWebAppAuthority["getChangesAfter"]>,
  authorization: AuthorizationContext,
): boolean {
  if (changes.kind !== "changes" || changes.changes.length === 0) {
    return false;
  }

  const bearerCapabilityGrantIds = new Set(
    isBearerShareAuthorizationContext(authorization)
      ? readAuthorizationCapabilityGrants(store, authorization).map((grant) => grant.id)
      : [],
  );
  const edgeById = createTransactionEdgeIndex(snapshot);
  for (const result of changes.changes) {
    for (const operation of result.transaction.ops) {
      const target = resolveOperationTarget(operation, edgeById);
      if (!target) {
        continue;
      }

      if (
        authorization.principalId !== null &&
        target.subjectId === authorization.principalId &&
        target.predicateId === principalCapabilityVersionPredicateId
      ) {
        return true;
      }

      if (
        bearerCapabilityGrantIds.size > 0 &&
        capabilityVersionTriggerPredicateIds.has(target.predicateId) &&
        hasEntityOfType(store, target.subjectId, capabilityGrantTypeId) &&
        bearerCapabilityGrantIds.has(target.subjectId)
      ) {
        return true;
      }

      if (
        !shareGrantVisibilityTriggerPredicateIds.has(target.predicateId) ||
        !hasEntityOfType(store, target.subjectId, shareGrantTypeId)
      ) {
        continue;
      }

      if (
        (authorization.principalId !== null &&
          resolveShareGrantPrincipalIds(store, target.subjectId).includes(
            authorization.principalId,
          )) ||
        (bearerCapabilityGrantIds.size > 0 &&
          (() => {
            const capabilityGrantId = readShareGrantCapabilityGrantId(store, target.subjectId);
            return capabilityGrantId ? bearerCapabilityGrantIds.has(capabilityGrantId) : false;
          })())
      ) {
        return true;
      }
    }
  }

  return false;
}

function listWorkflowProjectionSubjectIds(store: Store): string[] {
  const subjectIds = new Set<string>();
  for (const edge of store.snapshot().edges) {
    if (edge.p === typePredicateId && workflowProjectionReadEntityTypeIds.has(edge.o)) {
      subjectIds.add(edge.s);
    }
  }

  return [...subjectIds];
}

export async function createWebAppAuthority(
  storage: WebAppAuthorityStorage,
  options: WebAppAuthorityOptions = {},
): Promise<WebAppAuthority> {
  const graph = options.graph ?? webAppGraph;
  const { bootstrappedSnapshot, compiledFieldIndex, scalarByKey, typeByKey } =
    getCompiledGraphArtifacts(graph);
  const store = createStore(bootstrappedSnapshot);
  const {
    authority,
    persistedSecrets,
    refs: { pendingSecretWriteRef, retainedWorkflowProjectionRef },
    rebuildRetainedWorkflowProjection,
    replaceRetainedWorkflowProjection,
  } = await createBootstrappedWebAuthority({
    createCursorPrefix: createAuthorityCursorPrefix,
    createSecretStorageDriftError: (drift) => new WebAppAuthoritySecretStorageDriftError(drift),
    graph,
    hasBlockingSecretStartupDrift,
    retainedHistoryPolicy: options.retainedHistoryPolicy,
    secretHandleTypeId: core.secretHandle.values.id,
    secretHandleVersionPredicateId,
    seed() {
      if (options.seedExampleGraph !== false) {
        seedExampleGraph(createTypeClient(store, webAppGraph));
      }
    },
    storage,
    store,
    typePredicateId,
  });
  const secretValuesRef = {
    current: new Map(
      Object.entries(persistedSecrets).map(([secretId, secret]) => [secretId, secret.value]),
    ),
  };
  if (options.seedExampleGraph !== false) {
    const seeded = planAuthorityMutation(
      authority.store.snapshot(),
      `seed:example-graph-backfill:${Date.now()}`,
      (mutationGraph) => seedExampleGraph(mutationGraph),
    );
    if (seeded.changed) {
      await authority.applyTransaction(seeded.transaction, {
        writeScope: "server-command",
      });
    }
  }
  const workflowReviewInvalidationListener = options.onWorkflowReviewInvalidation;
  // Early persisted Better Auth rollouts could create graph principals without
  // `homeGraphId`. Repair them before any sync or direct graph reads materialize
  // those entities through the typed client.
  await repairLegacyPrincipalHomeGraphIds(authority);

  function readSnapshot(options: WebAppAuthorityReadOptions): StoreSnapshot {
    const readable = filterReadableSnapshot({
      store: authority.store,
      snapshot: authority.store.snapshot(),
      authorization: options.authorization,
      compiledFieldIndex,
    });
    if (readable.error) {
      throw createReadPolicyError(readable.error);
    }
    if (!readable.snapshot) {
      throw new Error("Readable snapshot filtering returned no snapshot.");
    }
    return readable.snapshot;
  }

  function readPredicateValue(
    subjectId: string,
    predicateId: string,
    options: WebAppAuthorityPredicateReadOptions,
  ): unknown {
    const fieldDefinition = compiledFieldIndex.get(predicateId);
    if (!fieldDefinition) {
      throw new WebAppAuthorityReadError(404, `Predicate "${predicateId}" was not found.`);
    }

    const staleContextError = assertCurrentAuthorizationVersion(
      authority.store,
      options.authorization,
    );
    if (staleContextError) {
      throw createReadPolicyError(staleContextError);
    }

    const decision = evaluateReadAuthorization(
      authority.store,
      options.authorization,
      compiledFieldIndex,
      createAuthorizationCapabilityResolver(authority.store, options.authorization),
      subjectId,
      predicateId,
    );
    if (!decision.allowed) {
      throw createReadPolicyError(decision.error);
    }

    return decodePredicateValue(
      authority.store,
      subjectId,
      fieldDefinition.field,
      scalarByKey,
      typeByKey,
      {
        strictRequired: options.strictRequired,
      },
    );
  }

  const scopedSyncServices = createScopedSyncServices({
    authority,
    compiledFieldIndex,
    createReadPolicyError,
    createScopeNotFoundError: (scopeId, moduleId) =>
      new WebAppAuthorityReadError(
        404,
        `Scope "${scopeId}" was not found for module "${moduleId}".`,
      ),
    createWorkflowProjectionPolicyError,
    createWorkflowLiveScopeError: (status, message, code) =>
      new WebAppAuthorityWorkflowLiveScopeError(status, message, code),
    getCurrentProjectionState: () => retainedWorkflowProjectionRef.current,
    isVisibilityResetRequired: (snapshot, changes, authorization) =>
      changesRequireVisibilityReset(authority.store, snapshot, changes, authorization),
    listWorkflowProjectionSubjectIds,
    rebuildProjectionState() {
      const workflowProjection = buildRetainedWorkflowProjectionState(
        authority.store.snapshot(),
        authority.createSyncPayload().cursor,
      );
      void replaceRetainedWorkflowProjection(workflowProjection).catch(() => {});
      return workflowProjection;
    },
    setProjectionState(workflowProjection) {
      retainedWorkflowProjectionRef.current = clonePersistedValue(workflowProjection);
    },
    typePredicateId,
    workflowModuleEntityTypeIds,
  });

  function readProjectBranchScope(
    query: ProjectBranchScopeQuery,
    options: WebAppAuthorityReadOptions,
  ): ProjectBranchScopeResult {
    try {
      return scopedSyncServices.readProjectBranchScope(query, options.authorization);
    } catch (error) {
      return throwWorkflowProjectionReadError(error);
    }
  }

  function readCommitQueueScope(
    query: CommitQueueScopeQuery,
    options: WebAppAuthorityReadOptions,
  ): CommitQueueScopeResult {
    try {
      return scopedSyncServices.readCommitQueueScope(query, options.authorization);
    } catch (error) {
      return throwWorkflowProjectionReadError(error);
    }
  }

  function planWorkflowReviewLiveRegistration(
    cursor: string,
    options: WebAppAuthorityReadOptions,
  ): WorkflowReviewLiveRegistrationTarget {
    return scopedSyncServices.planWorkflowReviewLiveRegistration(cursor, options.authorization);
  }

  function createSyncPayload(options: WebAppAuthoritySyncOptions) {
    return scopedSyncServices.createSyncPayload(options);
  }

  async function applyTransaction(
    transaction: GraphWriteTransaction,
    options: WebAppAuthorityTransactionOptions,
  ) {
    const writeScope = options.writeScope ?? "client-tx";
    const snapshot = authority.store.snapshot();
    const plannedTransaction = planCapabilityVersionInvalidationTransaction(snapshot, transaction);
    const touchedTypeIds = collectTouchedTypeIdsForTransaction(
      snapshot,
      authority.store,
      typePredicateId,
      plannedTransaction,
    );
    const authorizationError = validateTransactionAuthorization({
      transaction,
      snapshot,
      authorization: options.authorization,
      writeScope,
      compiledFieldIndex,
      buildValidationError: (issues) => buildTransactionValidationError(transaction, issues),
      formatPolicyErrorMessage,
    });
    if (authorizationError) {
      throw authorizationError;
    }
    const result = await authority.applyTransaction(plannedTransaction, {
      writeScope,
    });

    if (!result.replayed) {
      const invalidation = createWorkflowReviewInvalidationEvent({
        eventId: `workflow-review:${result.cursor}`,
        graphId: webAppGraphId,
        sourceCursor: result.cursor,
        touchedTypeIds,
      });
      if (invalidation) {
        try {
          // Live fan-out is ephemeral; losing it must not affect the committed write.
          workflowReviewInvalidationListener?.(invalidation);
        } catch {}
      }
    }

    return result;
  }

  function getIncrementalSyncResult(
    after: string | undefined,
    options: WebAppAuthoritySyncOptions,
  ) {
    return scopedSyncServices.getIncrementalSyncResult(after, options);
  }

  async function lookupBearerShare(input: BearerShareLookupInput): Promise<BearerShareProjection> {
    return readBearerShareProjection(authority.store, input);
  }

  async function lookupSessionPrincipal(
    input: SessionPrincipalLookupInput,
    options: WebAppAuthoritySessionPrincipalLookupOptions = {},
  ): Promise<SessionPrincipalProjection> {
    const exactProjectionIds = listActiveAuthSubjectProjectionIds(authority.store, input.subject);
    if (exactProjectionIds.length > 1) {
      createConflictingAuthSubjectProjectionError(input, exactProjectionIds);
    }

    const exactProjectionId = exactProjectionIds[0];
    if (exactProjectionId) {
      const resolved = readProjectionSessionPrincipalProjection(
        authority.store,
        exactProjectionId,
        input.graphId,
      );
      if (resolved) return resolved;
    }

    const authUserPrincipalIds = readAuthUserPrincipalIds(
      authority.store,
      input.graphId,
      input.subject.authUserId,
    );
    if (authUserPrincipalIds.length > 1) {
      createConflictingSessionPrincipalLookupError(input, authUserPrincipalIds);
    }

    if (options.allowRepair === false) {
      createMissingSessionPrincipalLookupError(input);
    }

    const repaired = planAuthorityMutation(
      authority.store.snapshot(),
      `auth-subject-repair:${Date.now()}`,
      (mutationGraph) => {
        const principalId =
          authUserPrincipalIds[0] ??
          mutationGraph.principal.create({
            homeGraphId: input.graphId,
            kind: core.principalKind.values.human.id,
            name: buildPrincipalName(input.subject),
            status: activePrincipalStatusId,
          });
        const mirroredAt = new Date();
        const projectionName = buildAuthSubjectProjectionName(input.subject);
        const projectionId =
          exactProjectionId ??
          mutationGraph.authSubjectProjection.create({
            authUserId: input.subject.authUserId,
            issuer: input.subject.issuer,
            mirroredAt,
            name: projectionName,
            principal: principalId,
            provider: input.subject.provider,
            providerAccountId: input.subject.providerAccountId,
            status: activeAuthSubjectStatusId,
          });

        if (exactProjectionId) {
          mutationGraph.authSubjectProjection.update(exactProjectionId, {
            mirroredAt,
            name: projectionName,
            principal: principalId,
            status: activeAuthSubjectStatusId,
          });
        }

        return {
          principalId,
          projectionId,
        };
      },
    );

    if (repaired.changed) {
      await authority.applyTransaction(repaired.transaction, {
        writeScope: "authority-only",
      });
    }

    const resolved = readProjectionSessionPrincipalProjection(
      authority.store,
      repaired.result.projectionId,
      input.graphId,
    );
    if (resolved) return resolved;

    createMissingSessionPrincipalLookupError(input);
  }

  const commandServices = createWebAuthorityCommandServices({
    applyStagedMutation: applyStagedWebAuthorityMutation,
    applyTransaction,
    authorityStore: authority.store,
    buildMutation: (txId, mutate) =>
      planAuthorityMutation(authority.store.snapshot(), txId, mutate),
    compiledFieldIndex,
    createCommandPolicyError,
    createMutationError: (status, message) => new WebAppAuthorityMutationError(status, message),
    getEntityLabel,
    getFirstObject,
    pendingSecretWriteRef,
    secretHandleLastRotatedAtPredicateId,
    secretHandleVersionPredicateId,
    secretValuesRef,
    setSingleReferenceField,
    typePredicateId,
    writeSecretFieldCommandBasePredicateIds,
    writeSecretFieldCommandKey,
  });

  async function executeCommand<Command extends WebAppAuthorityCommand>(
    command: Command,
    options: WebAppAuthorityCommandOptions,
  ): Promise<WebAppAuthorityCommandResult<Command["kind"]>> {
    return commandServices.executeCommand(command, options);
  }

  async function writeSecretField(
    input: WriteSecretFieldInput,
    options: WebAppAuthoritySecretFieldOptions,
  ): Promise<WriteSecretFieldResult> {
    return commandServices.runWriteSecretFieldCommand(input, options);
  }

  const { graph: _graph, store: _store, ...authorityApi } = authority;

  return {
    ...authorityApi,
    executeCommand,
    applyTransaction,
    createSyncPayload,
    getIncrementalSyncResult,
    lookupBearerShare,
    lookupSessionPrincipal,
    planWorkflowReviewLiveRegistration,
    readCommitQueueScope,
    readPredicateValue,
    readProjectBranchScope,
    readSnapshot,
    rebuildRetainedWorkflowProjection,
    writeSecretField,
  };
}
