import {
  createModuleReadScopeRequest,
  defineModuleReadScopeDefinition,
  defineProjectionCatalog,
  defineProjectionSpec,
} from "../../../runtime/projection.js";

export const workflowModuleId = "ops/workflow";

export const workflowReviewModuleReadScope = defineModuleReadScopeDefinition({
  kind: "module",
  moduleId: workflowModuleId,
  scopeId: "scope:ops/workflow:review",
  definitionHash: "scope-def:ops/workflow:review:v1",
});

export const workflowReviewSyncScopeRequest = createModuleReadScopeRequest(
  workflowReviewModuleReadScope,
);

export const workflowProjectBranchBoardProjection = defineProjectionSpec({
  projectionId: "ops/workflow:project-branch-board",
  kind: "collection-index",
  definitionHash: "projection-def:ops/workflow:project-branch-board:v1",
  sourceScopeKinds: ["module"],
  dependencyKeys: [
    "projection:ops/workflow:project-branch-board",
    workflowReviewModuleReadScope.scopeId,
  ],
  rebuildStrategy: "full",
  visibilityMode: "policy-filtered",
});

export const workflowBranchCommitQueueProjection = defineProjectionSpec({
  projectionId: "ops/workflow:branch-commit-queue",
  kind: "collection-index",
  definitionHash: "projection-def:ops/workflow:branch-commit-queue:v1",
  sourceScopeKinds: ["module"],
  dependencyKeys: [
    "projection:ops/workflow:branch-commit-queue",
    workflowReviewModuleReadScope.scopeId,
  ],
  rebuildStrategy: "full",
  visibilityMode: "policy-filtered",
});

export const workflowProjectionCatalog = defineProjectionCatalog([
  workflowProjectBranchBoardProjection,
  workflowBranchCommitQueueProjection,
] as const);

export const workflowProjectionMetadata = Object.freeze({
  projectBranchBoard: workflowProjectBranchBoardProjection,
  branchCommitQueue: workflowBranchCommitQueueProjection,
});

export const workflowProjectionIds = Object.freeze({
  projectBranchBoard: workflowProjectBranchBoardProjection.projectionId,
  branchCommitQueue: workflowBranchCommitQueueProjection.projectionId,
});

export const workflowProjectionDefinitionHashes = Object.freeze({
  reviewScope: workflowReviewModuleReadScope.definitionHash,
  projectBranchBoard: workflowProjectBranchBoardProjection.definitionHash,
  branchCommitQueue: workflowBranchCommitQueueProjection.definitionHash,
});
