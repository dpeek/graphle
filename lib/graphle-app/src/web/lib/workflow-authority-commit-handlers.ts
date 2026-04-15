import { edgeId, type GraphStore } from "@dpeek/graphle-app/graph";
import { workflow } from "@dpeek/graphle-module-workflow";
import {
  repositoryCommitLeaseStateValues,
  repositoryCommitStateValues,
  commitStateValues,
  workflowMutableSessionKindValues,
  workflowMutableSessionStatusValues,
  type WorkflowBranchStateValue,
  type WorkflowMutationAction,
  type WorkflowMutationResult,
} from "@dpeek/graphle-module-workflow";

import {
  requireAgentSession,
  requireBranch,
  requireCommit,
  requireDocument,
  requireRepository,
  requireRepositoryBranch,
  requireRepositoryCommit,
  requireUniqueCommitKey,
} from "./workflow-authority-shared.js";
import {
  WorkflowMutationError,
  buildBranchSummary,
  buildCommitSummary,
  buildRepositoryCommitSummary,
  buildSessionSummary,
  clearSingleValue,
  decodeRepositoryCommitLeaseState,
  decodeRepositoryCommitState,
  decodeWorkflowBranchState,
  decodeWorkflowCommitState,
  isWorkflowCommitTerminal,
  normalizeRepositoryCommitLeaseState,
  parseOptionalDate,
  commitGateIds,
  repositoryCommitLeaseStateIds,
  repositoryCommitStateIds,
  requireAllowedValue,
  requireStoredWorkflowSessionKind,
  requireStoredWorkflowSessionStatus,
  requireString,
  requireWorkflowTransition,
  setSingleValue,
  trimOptionalString,
  type ProductGraphClient,
  branchStateIds,
  branchTransitions,
  commitStateIds,
  commitTransitions,
} from "./workflow-mutation-helpers.js";

type CommitCreateMutation = Extract<WorkflowMutationAction, { action: "createCommit" }>;
type CommitUpdateMutation = Extract<WorkflowMutationAction, { action: "updateCommit" }>;
type CommitStateMutation = Extract<WorkflowMutationAction, { action: "setCommitState" }>;
type CommitUserReviewRequestMutation = Extract<
  WorkflowMutationAction,
  { action: "requestCommitUserReview" }
>;
type CommitUserReviewClearMutation = Extract<
  WorkflowMutationAction,
  { action: "clearCommitUserReview" }
>;
type SessionCreateMutation = Extract<WorkflowMutationAction, { action: "createSession" }>;
type SessionUpdateMutation = Extract<WorkflowMutationAction, { action: "updateSession" }>;
type RepositoryCommitCreateMutation = Extract<
  WorkflowMutationAction,
  { action: "createRepositoryCommit" }
>;
type CommitFinalizationMutation = Extract<WorkflowMutationAction, { action: "finalizeCommit" }>;
type RepositoryCommitRecord = ReturnType<ProductGraphClient["repositoryCommit"]["get"]>;

export function findManagedRepositoryBranchForBranch(graph: ProductGraphClient, branchId: string) {
  return graph.repositoryBranch
    .list()
    .find((repositoryBranch) => repositoryBranch.branch === branchId && repositoryBranch.managed);
}

function findRepositoryCommitForWorkflowCommit(
  graph: ProductGraphClient,
  commitId: string,
  exceptRepositoryCommitId?: string,
) {
  return graph.repositoryCommit
    .list()
    .find(
      (repositoryCommit) =>
        repositoryCommit.commit === commitId && repositoryCommit.id !== exceptRepositoryCommitId,
    );
}

function listBranchCommits(graph: ProductGraphClient, branchId: string) {
  return graph.commit.list().filter((commit) => commit.branch === branchId);
}

function compareBranchCommitOrder(
  left: ReturnType<ProductGraphClient["commit"]["get"]>,
  right: ReturnType<ProductGraphClient["commit"]["get"]>,
) {
  return (
    left.order - right.order ||
    left.createdAt.getTime() - right.createdAt.getTime() ||
    left.updatedAt.getTime() - right.updatedAt.getTime() ||
    left.id.localeCompare(right.id)
  );
}

function deriveBranchStateAfterCommitLifecycle(
  graph: ProductGraphClient,
  branchId: string,
): WorkflowBranchStateValue {
  const commits = listBranchCommits(graph, branchId);
  if (commits.some((commit) => decodeWorkflowCommitState(commit.state) === "active")) {
    return "active";
  }
  if (commits.some((commit) => decodeWorkflowCommitState(commit.state) === "blocked")) {
    return "blocked";
  }
  return commits.length > 0 &&
    commits.every((commit) => isWorkflowCommitTerminal(decodeWorkflowCommitState(commit.state)))
    ? "done"
    : "ready";
}

function deriveBranchLifecycleAfterFinalization(
  graph: ProductGraphClient,
  branchId: string,
): {
  readonly activeCommitId?: string;
  readonly state: WorkflowBranchStateValue;
} {
  const commits = listBranchCommits(graph, branchId).sort(compareBranchCommitOrder);
  const activeCommit = commits.find(
    (commit) => decodeWorkflowCommitState(commit.state) === "active",
  );
  if (activeCommit) {
    return {
      activeCommitId: activeCommit.id,
      state: "active",
    };
  }

  const blockedCommit = commits.find(
    (commit) => decodeWorkflowCommitState(commit.state) === "blocked",
  );
  if (blockedCommit) {
    return {
      activeCommitId: blockedCommit.id,
      state: "blocked",
    };
  }

  const readyCommit = commits.find((commit) => decodeWorkflowCommitState(commit.state) === "ready");
  if (readyCommit) {
    return {
      activeCommitId: readyCommit.id,
      state: "ready",
    };
  }

  return {
    state: deriveBranchStateAfterCommitLifecycle(graph, branchId),
  };
}

export function requireBranchRepositoryTarget(graph: ProductGraphClient, branchId: string) {
  const repositoryBranch = findManagedRepositoryBranchForBranch(graph, branchId);
  if (!repositoryBranch) {
    throw new WorkflowMutationError(
      409,
      `Workflow branch "${branchId}" does not have a managed repository branch target.`,
      "repository-missing",
    );
  }
  return repositoryBranch;
}

function resolveExistingRepositoryCommitForFinalization(
  graph: ProductGraphClient,
  store: GraphStore,
  commit: ReturnType<ProductGraphClient["commit"]["get"]>,
  input: CommitFinalizationMutation,
): RepositoryCommitRecord | undefined {
  const repositoryCommit =
    input.git?.repositoryCommitId !== undefined
      ? requireRepositoryCommit(
          graph,
          store,
          requireString(input.git.repositoryCommitId, "Repository commit id"),
        )
      : findRepositoryCommitForWorkflowCommit(graph, commit.id);

  if (!repositoryCommit) {
    if (input.git && input.outcome !== "committed") {
      throw new WorkflowMutationError(
        409,
        `Workflow commit "${commit.id}" cannot record git finalization metadata without a repository commit record.`,
        "repository-missing",
      );
    }
    return undefined;
  }

  if (repositoryCommit.commit && repositoryCommit.commit !== commit.id) {
    throw new WorkflowMutationError(
      409,
      `Repository commit "${repositoryCommit.id}" is already attached to workflow commit "${repositoryCommit.commit}".`,
      "commit-lock-conflict",
    );
  }

  const existingRepositoryCommit = findRepositoryCommitForWorkflowCommit(
    graph,
    commit.id,
    repositoryCommit.id,
  );
  if (existingRepositoryCommit) {
    throw new WorkflowMutationError(
      409,
      `Workflow commit "${commit.id}" is already attached to repository commit "${existingRepositoryCommit.id}".`,
      "commit-lock-conflict",
    );
  }

  return repositoryCommit;
}

function resolveRepositoryCommitTargetForFinalization(
  graph: ProductGraphClient,
  store: GraphStore,
  branch: ReturnType<ProductGraphClient["branch"]["get"]>,
  repositoryId: string,
  commitId: string,
  repositoryBranchId: string | null | undefined,
) {
  const repository = requireRepository(graph, store, repositoryId);
  if (branch.project !== repository.project) {
    throw new WorkflowMutationError(
      409,
      `Workflow commit branch "${branch.id}" does not belong to repository "${repository.id}".`,
      "invalid-transition",
    );
  }

  const managedRepositoryBranch = requireBranchRepositoryTarget(graph, branch.id);
  const selectedRepositoryBranch =
    repositoryBranchId !== undefined
      ? requireRepositoryBranch(
          graph,
          store,
          requireString(repositoryBranchId, "Repository branch id"),
        )
      : managedRepositoryBranch;

  if (selectedRepositoryBranch.repository !== repository.id) {
    throw new WorkflowMutationError(
      409,
      `Repository branch "${selectedRepositoryBranch.id}" does not belong to repository "${repository.id}".`,
      "invalid-transition",
    );
  }
  if (selectedRepositoryBranch.id !== managedRepositoryBranch.id) {
    throw new WorkflowMutationError(
      409,
      `Workflow commit "${commitId}" requires managed repository branch "${managedRepositoryBranch.id}".`,
      "repository-missing",
    );
  }

  return {
    repository,
    repositoryBranch: selectedRepositoryBranch,
  };
}

function buildRepositoryCommitWorktreeCreateInput(
  input:
    | {
        readonly branchName?: string | null;
        readonly leaseState?: (typeof repositoryCommitLeaseStateValues)[number];
        readonly path?: string | null;
      }
    | undefined,
  defaultLeaseState: (typeof repositoryCommitLeaseStateValues)[number],
) {
  const leaseState =
    input?.leaseState === undefined
      ? defaultLeaseState
      : requireAllowedValue(
          input.leaseState,
          repositoryCommitLeaseStateValues,
          "Repository commit lease state",
        );
  const path = trimOptionalString(input?.path);
  const branchName = trimOptionalString(input?.branchName);

  return {
    ...(path ? { path } : {}),
    ...(branchName ? { branchName } : {}),
    leaseState: repositoryCommitLeaseStateIds[leaseState],
  };
}

function buildRepositoryCommitWorktreePatch(
  store: GraphStore,
  repositoryCommit: RepositoryCommitRecord,
  input:
    | {
        readonly branchName?: string | null;
        readonly leaseState?: (typeof repositoryCommitLeaseStateValues)[number];
        readonly path?: string | null;
      }
    | undefined,
  defaultLeaseState?: (typeof repositoryCommitLeaseStateValues)[number],
) {
  let worktreePatch: Record<string, unknown> | undefined;
  const nextLeaseState = input?.leaseState === undefined ? defaultLeaseState : input.leaseState;
  if (nextLeaseState !== undefined) {
    worktreePatch = {
      leaseState:
        repositoryCommitLeaseStateIds[
          input?.leaseState === undefined
            ? nextLeaseState
            : requireAllowedValue(
                input.leaseState,
                repositoryCommitLeaseStateValues,
                "Repository commit lease state",
              )
        ],
    };
  }
  if (input?.path !== undefined) {
    if (input.path === null) {
      clearSingleValue(
        store,
        repositoryCommit.id,
        edgeId(workflow.repositoryCommit.fields.worktree.path),
      );
    } else {
      worktreePatch = {
        ...worktreePatch,
        path: requireString(input.path, "Worktree path"),
      };
    }
  }
  if (input?.branchName !== undefined) {
    if (input.branchName === null) {
      clearSingleValue(
        store,
        repositoryCommit.id,
        edgeId(workflow.repositoryCommit.fields.worktree.branchName),
      );
    } else {
      worktreePatch = {
        ...worktreePatch,
        branchName: requireString(input.branchName, "Worktree branch name"),
      };
    }
  }
  return worktreePatch;
}

function persistRepositoryCommitFinalization(
  graph: ProductGraphClient,
  store: GraphStore,
  branch: ReturnType<ProductGraphClient["branch"]["get"]>,
  commit: ReturnType<ProductGraphClient["commit"]["get"]>,
  input: CommitFinalizationMutation,
) {
  const repositoryCommit = resolveExistingRepositoryCommitForFinalization(
    graph,
    store,
    commit,
    input,
  );

  if (!repositoryCommit) {
    if (input.outcome !== "committed") {
      return undefined;
    }

    const managedRepositoryBranch = requireBranchRepositoryTarget(graph, branch.id);
    const { repository, repositoryBranch } = resolveRepositoryCommitTargetForFinalization(
      graph,
      store,
      branch,
      managedRepositoryBranch.repository,
      commit.id,
      input.git.repositoryBranchId,
    );
    const repositoryCommitId = graph.repositoryCommit.create({
      name: trimOptionalString(input.git.title) ?? commit.name,
      repository: repository.id,
      repositoryBranch: repositoryBranch.id,
      commit: commit.id,
      state: repositoryCommitStateIds.committed,
      worktree: buildRepositoryCommitWorktreeCreateInput(input.git.worktree, "released"),
      sha: requireString(input.git.sha, "Commit SHA"),
      committedAt: parseOptionalDate(input.git.committedAt, "Committed at") ?? new Date(),
    });

    return buildRepositoryCommitSummary(graph.repositoryCommit.get(repositoryCommitId));
  }

  const { repositoryBranch } = resolveRepositoryCommitTargetForFinalization(
    graph,
    store,
    branch,
    repositoryCommit.repository,
    commit.id,
    input.git?.repositoryBranchId ?? repositoryCommit.repositoryBranch,
  );
  const patch: Record<string, unknown> = {
    repositoryBranch: repositoryBranch.id,
    commit: commit.id,
  };

  if (input.git) {
    patch.name = trimOptionalString(input.git.title) ?? repositoryCommit.name ?? commit.name;
    const worktreePatch = buildRepositoryCommitWorktreePatch(
      store,
      repositoryCommit,
      input.git.worktree,
      input.outcome === "committed"
        ? "released"
        : decodeRepositoryCommitLeaseState(repositoryCommit.worktree.leaseState),
    );
    if (worktreePatch) {
      patch.worktree = worktreePatch;
    }
  }

  if (input.outcome === "committed") {
    patch.state = repositoryCommitStateIds.committed;
    patch.sha = requireString(input.git.sha, "Commit SHA");
    patch.committedAt = parseOptionalDate(input.git.committedAt, "Committed at") ?? new Date();
  }

  graph.repositoryCommit.update(repositoryCommit.id, patch);
  return buildRepositoryCommitSummary(graph.repositoryCommit.get(repositoryCommit.id));
}

function reconcileBranchAfterCommitChange(
  graph: ProductGraphClient,
  store: GraphStore,
  branchId: string,
  commitId: string,
): void {
  const branch = graph.branch.get(branchId);
  if (branch.activeCommit === commitId) {
    clearSingleValue(store, branchId, edgeId(workflow.branch.fields.activeCommit));
  }
  const nextState = deriveBranchStateAfterCommitLifecycle(graph, branchId);
  graph.branch.update(branchId, {
    state: branchStateIds[nextState],
  });
}

function advanceBranchAfterCommitFinalization(
  graph: ProductGraphClient,
  store: GraphStore,
  branchId: string,
): void {
  const nextLifecycle = deriveBranchLifecycleAfterFinalization(graph, branchId);

  if (nextLifecycle.activeCommitId) {
    setSingleValue(
      store,
      branchId,
      edgeId(workflow.branch.fields.activeCommit),
      nextLifecycle.activeCommitId,
    );
  } else {
    clearSingleValue(store, branchId, edgeId(workflow.branch.fields.activeCommit));
  }

  graph.branch.update(branchId, {
    state: branchStateIds[nextLifecycle.state],
  });
}

function findWorkflowSessionByProjectAndKey(
  graph: ProductGraphClient,
  projectId: string,
  sessionKey: string,
) {
  return graph.agentSession
    .list()
    .find((session) => session.project === projectId && session.sessionKey === sessionKey);
}

function findAttachedRepositoryForProject(graph: ProductGraphClient, projectId: string) {
  const repositories = graph.repository
    .list()
    .filter((repository) => repository.project === projectId);
  if (repositories.length > 1) {
    throw new WorkflowMutationError(
      409,
      `Workflow project "${projectId}" has multiple attached repositories.`,
      "invalid-transition",
    );
  }
  return repositories[0];
}

type WorkflowCommitUserReviewMetadataPatch = Pick<
  CommitUserReviewRequestMutation,
  "reason" | "requestedAt" | "requestedBySessionId"
>;
type WorkflowCommitUserReviewMetadataResolution = {
  readonly patch: Record<string, unknown>;
  readonly reason?: string;
  readonly requestedAt?: Date;
  readonly requestedBySession?: ReturnType<ProductGraphClient["agentSession"]["get"]>;
};

function clearWorkflowCommitUserReviewMetadata(store: GraphStore, commitId: string): void {
  clearSingleValue(store, commitId, edgeId(workflow.commit.fields.gateReason));
  clearSingleValue(store, commitId, edgeId(workflow.commit.fields.gateRequestedAt));
  clearSingleValue(store, commitId, edgeId(workflow.commit.fields.gateRequestedBySessionId));
}

function resolveWorkflowCommitUserReviewRequestingSession(
  graph: ProductGraphClient,
  store: GraphStore,
  commitId: string,
  requestedBySessionId: string | undefined,
) {
  if (!requestedBySessionId) {
    return undefined;
  }

  const session = requireAgentSession(graph, store, requestedBySessionId);
  if (session.commit !== commitId) {
    throw new WorkflowMutationError(
      409,
      `Workflow session "${session.id}" does not belong to commit "${commitId}".`,
      "invalid-transition",
    );
  }
  return session;
}

function resolveWorkflowCommitUserReviewMetadataPatch(
  graph: ProductGraphClient,
  store: GraphStore,
  commitId: string,
  input: WorkflowCommitUserReviewMetadataPatch,
): WorkflowCommitUserReviewMetadataResolution {
  const patch: Record<string, unknown> = {};
  const reason = trimOptionalString(input.reason);
  if (reason) {
    patch.gateReason = reason;
  } else {
    clearSingleValue(store, commitId, edgeId(workflow.commit.fields.gateReason));
  }

  const requestedAt = parseOptionalDate(input.requestedAt, "Workflow gate requested at");
  if (requestedAt) {
    patch.gateRequestedAt = requestedAt;
  } else {
    clearSingleValue(store, commitId, edgeId(workflow.commit.fields.gateRequestedAt));
  }

  const requestedBySession = resolveWorkflowCommitUserReviewRequestingSession(
    graph,
    store,
    commitId,
    trimOptionalString(input.requestedBySessionId),
  );
  if (requestedBySession) {
    patch.gateRequestedBySessionId = requestedBySession.id;
  } else {
    clearSingleValue(store, commitId, edgeId(workflow.commit.fields.gateRequestedBySessionId));
  }

  return {
    patch,
    ...(reason ? { reason } : {}),
    ...(requestedAt ? { requestedAt } : {}),
    ...(requestedBySession ? { requestedBySession } : {}),
  };
}

function createWorkflowCommitUserReviewDecisionDetails(input: {
  readonly commit: ReturnType<ProductGraphClient["commit"]["get"]>;
  readonly requestedBySession: ReturnType<ProductGraphClient["agentSession"]["get"]>;
  readonly reason?: string;
}): string {
  const details = [
    `Pause commit "${input.commit.name}" (${input.commit.commitKey}) for explicit operator review.`,
    `Requested by session "${input.requestedBySession.name}" (${input.requestedBySession.sessionKey}).`,
    input.reason ? `Gate reason: ${input.reason}` : "No explicit gate reason was recorded.",
  ];
  return details.join(" ");
}

function shouldRecordWorkflowCommitUserReviewDecision(input: {
  readonly commit: ReturnType<ProductGraphClient["commit"]["get"]>;
  readonly reason?: string;
  readonly requestedAt?: Date;
  readonly requestedBySession: ReturnType<ProductGraphClient["agentSession"]["get"]>;
}): boolean {
  return !(
    input.commit.gate === commitGateIds.UserReview &&
    input.commit.gateReason === input.reason &&
    input.commit.gateRequestedBySessionId === input.requestedBySession.id &&
    input.commit.gateRequestedAt?.toISOString() === input.requestedAt?.toISOString()
  );
}

function recordWorkflowCommitUserReviewDecision(
  graph: ProductGraphClient,
  input: {
    readonly commit: ReturnType<ProductGraphClient["commit"]["get"]>;
    readonly reason?: string;
    readonly requestedAt?: Date;
    readonly requestedBySession: ReturnType<ProductGraphClient["agentSession"]["get"]>;
  },
): void {
  graph.decision.create({
    name: "Review requested",
    project: input.requestedBySession.project,
    ...(input.requestedBySession.repository
      ? { repository: input.requestedBySession.repository }
      : {}),
    branch: input.commit.branch,
    commit: input.commit.id,
    session: input.requestedBySession.id,
    kind: workflow.decisionKind.values.blocker.id as string,
    details: createWorkflowCommitUserReviewDecisionDetails(input),
  });
}

function validateWorkflowSessionCreateSubject(
  graph: ProductGraphClient,
  store: GraphStore,
  commitId: string,
) {
  const commit = requireCommit(graph, store, requireString(commitId, "Workflow commit id"));
  const branch = requireBranch(graph, store, commit.branch);
  const repository = findAttachedRepositoryForProject(graph, branch.project);
  return {
    branch,
    commit,
    projectId: branch.project,
    repositoryId: repository?.id,
  };
}

function resolveWorkflowSessionStatus(status: SessionCreateMutation["status"] | undefined) {
  return status === undefined
    ? "Open"
    : requireAllowedValue(status, workflowMutableSessionStatusValues, "Workflow session status");
}

function resolveWorkflowSessionKind(kind: SessionCreateMutation["kind"]) {
  return requireAllowedValue(kind, workflowMutableSessionKindValues, "Workflow session kind");
}

function resolveCreateSessionEndedAt(
  status: ReturnType<typeof resolveWorkflowSessionStatus>,
  value: SessionCreateMutation["endedAt"],
) {
  const endedAt = parseOptionalDate(value, "Workflow session ended at");
  if (status === "Done") {
    if (endedAt === null) {
      throw new WorkflowMutationError(
        400,
        "Workflow session ended at must be a valid ISO timestamp when the session is done.",
      );
    }
    return endedAt ?? new Date();
  }
  if (endedAt) {
    throw new WorkflowMutationError(
      400,
      "Workflow session ended at can only be set when the session status is Done.",
    );
  }
  return undefined;
}

export function createWorkflowCommit(
  graph: ProductGraphClient,
  store: GraphStore,
  input: CommitCreateMutation,
): WorkflowMutationResult {
  const branch = requireBranch(graph, store, requireString(input.branchId, "Branch id"));
  const branchState = decodeWorkflowBranchState(branch.state);
  if (branchState === "done" || branchState === "archived") {
    throw new WorkflowMutationError(
      409,
      `Workflow branch "${branch.id}" does not accept new commits in state "${branchState}".`,
      "invalid-transition",
    );
  }
  const commitKey = requireString(input.commitKey, "Commit key");
  requireUniqueCommitKey(graph, commitKey);
  let parentCommitId: string | undefined;
  if (input.parentCommitId) {
    const parentCommit = requireCommit(
      graph,
      store,
      requireString(input.parentCommitId, "Parent commit id"),
    );
    if (parentCommit.branch !== branch.id) {
      throw new WorkflowMutationError(
        409,
        `Parent commit "${parentCommit.id}" does not belong to branch "${branch.id}".`,
        "invalid-transition",
      );
    }
    parentCommitId = parentCommit.id;
  }
  const requestedState =
    input.state === undefined
      ? "planned"
      : requireAllowedValue(input.state, ["planned", "ready"] as const, "Workflow commit state");
  const commitId = graph.commit.create({
    name: requireString(input.title, "Commit title"),
    branch: branch.id,
    commitKey,
    state: commitStateIds[requestedState],
    order: input.order,
    ...(input.context !== undefined && input.context !== null
      ? { context: requireString(input.context, "Commit context") }
      : {}),
    ...(input.references !== undefined && input.references !== null
      ? { references: requireString(input.references, "Commit references") }
      : {}),
    ...(parentCommitId ? { parentCommit: parentCommitId } : {}),
    ...(input.contextDocumentId !== undefined && input.contextDocumentId !== null
      ? {
          contextDocument: requireDocument(
            graph,
            store,
            requireString(input.contextDocumentId, "Context document id"),
          ).id,
        }
      : {}),
  });
  return {
    action: input.action,
    created: true,
    summary: buildCommitSummary(graph.commit.get(commitId)),
  };
}

export function updateWorkflowCommit(
  graph: ProductGraphClient,
  store: GraphStore,
  input: CommitUpdateMutation,
): WorkflowMutationResult {
  const commit = requireCommit(graph, store, requireString(input.commitId, "Commit id"));
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.name = input.title;
  if (input.commitKey !== undefined) {
    const commitKey = requireString(input.commitKey, "Commit key");
    requireUniqueCommitKey(graph, commitKey, commit.id);
    patch.commitKey = commitKey;
  }
  if (input.order !== undefined) patch.order = input.order;
  if (input.parentCommitId !== undefined) {
    if (input.parentCommitId === null) {
      clearSingleValue(store, commit.id, edgeId(workflow.commit.fields.parentCommit));
    } else {
      const parentCommit = requireCommit(
        graph,
        store,
        requireString(input.parentCommitId, "Parent commit id"),
      );
      if (parentCommit.id === commit.id) {
        throw new WorkflowMutationError(
          409,
          `Workflow commit "${commit.id}" cannot parent itself.`,
          "invalid-transition",
        );
      }
      if (parentCommit.branch !== commit.branch) {
        throw new WorkflowMutationError(
          409,
          `Parent commit "${parentCommit.id}" does not belong to branch "${commit.branch}".`,
          "invalid-transition",
        );
      }
      patch.parentCommit = parentCommit.id;
    }
  }
  if (input.contextDocumentId !== undefined) {
    if (input.contextDocumentId === null) {
      clearSingleValue(store, commit.id, edgeId(workflow.commit.fields.contextDocument));
    } else {
      patch.contextDocument = requireDocument(
        graph,
        store,
        requireString(input.contextDocumentId, "Context document id"),
      ).id;
    }
  }
  if (input.context !== undefined) {
    if (input.context === null) {
      clearSingleValue(store, commit.id, edgeId(workflow.commit.fields.context));
    } else {
      patch.context = requireString(input.context, "Commit context");
    }
  }
  if (input.references !== undefined) {
    if (input.references === null) {
      clearSingleValue(store, commit.id, edgeId(workflow.commit.fields.references));
    } else {
      patch.references = requireString(input.references, "Commit references");
    }
  }
  if (Object.keys(patch).length > 0) {
    graph.commit.update(commit.id, patch);
  }
  return {
    action: input.action,
    created: false,
    summary: buildCommitSummary(graph.commit.get(commit.id)),
  };
}

export function createWorkflowSession(
  graph: ProductGraphClient,
  store: GraphStore,
  input: SessionCreateMutation,
): WorkflowMutationResult {
  const { branch, commit, projectId, repositoryId } = validateWorkflowSessionCreateSubject(
    graph,
    store,
    input.commitId,
  );
  const sessionKey = requireString(input.sessionKey, "Workflow session key");
  const existingSession = findWorkflowSessionByProjectAndKey(graph, projectId, sessionKey);
  if (existingSession) {
    throw new WorkflowMutationError(
      409,
      `Workflow session key "${sessionKey}" is already in use by "${existingSession.id}".`,
      "invalid-transition",
    );
  }

  const kind = resolveWorkflowSessionKind(input.kind);
  const status = resolveWorkflowSessionStatus(input.status);
  const endedAt = resolveCreateSessionEndedAt(status, input.endedAt);
  const startedAt = parseOptionalDate(input.startedAt, "Workflow session started at");
  const sessionId = graph.agentSession.create({
    name: requireString(input.name, "Workflow session name"),
    project: projectId,
    ...(repositoryId ? { repository: repositoryId } : {}),
    subjectKind: workflow.agentSessionSubjectKind.values.commit.id as string,
    branch: branch.id,
    commit: commit.id,
    sessionKey,
    kind: requireStoredWorkflowSessionKind(kind),
    workerId: requireString(input.workerId, "Workflow session worker id"),
    ...(input.context !== undefined && input.context !== null
      ? { context: requireString(input.context, "Workflow session context") }
      : {}),
    ...(input.references !== undefined && input.references !== null
      ? { references: requireString(input.references, "Workflow session references") }
      : {}),
    ...(input.threadId !== undefined && input.threadId !== null
      ? { threadId: requireString(input.threadId, "Workflow session thread id") }
      : {}),
    ...(input.turnId !== undefined && input.turnId !== null
      ? { turnId: requireString(input.turnId, "Workflow session turn id") }
      : {}),
    runtimeState: requireStoredWorkflowSessionStatus(status),
    ...(startedAt ? { startedAt } : {}),
    ...(endedAt ? { endedAt } : {}),
  });

  return {
    action: input.action,
    created: true,
    summary: buildSessionSummary(graph.agentSession.get(sessionId)),
  };
}

export function updateWorkflowSession(
  graph: ProductGraphClient,
  store: GraphStore,
  input: SessionUpdateMutation,
): WorkflowMutationResult {
  const session = requireAgentSession(graph, store, requireString(input.sessionId, "Session id"));
  if (!session.commit) {
    throw new WorkflowMutationError(
      409,
      `Workflow session "${session.id}" is missing commit provenance.`,
      "invalid-transition",
    );
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    patch.name = requireString(input.name, "Workflow session name");
  }
  if (input.context !== undefined) {
    if (input.context === null) {
      clearSingleValue(store, session.id, edgeId(workflow.agentSession.fields.context));
    } else {
      patch.context = requireString(input.context, "Workflow session context");
    }
  }
  if (input.references !== undefined) {
    if (input.references === null) {
      clearSingleValue(store, session.id, edgeId(workflow.agentSession.fields.references));
    } else {
      patch.references = requireString(input.references, "Workflow session references");
    }
  }
  if (input.threadId !== undefined) {
    if (input.threadId === null) {
      clearSingleValue(store, session.id, edgeId(workflow.agentSession.fields.threadId));
    } else {
      patch.threadId = requireString(input.threadId, "Workflow session thread id");
    }
  }
  if (input.turnId !== undefined) {
    if (input.turnId === null) {
      clearSingleValue(store, session.id, edgeId(workflow.agentSession.fields.turnId));
    } else {
      patch.turnId = requireString(input.turnId, "Workflow session turn id");
    }
  }
  if (input.status !== undefined) {
    const status = resolveWorkflowSessionStatus(input.status);
    patch.runtimeState = requireStoredWorkflowSessionStatus(status);
    if (status === "Open") {
      if (input.endedAt) {
        throw new WorkflowMutationError(
          400,
          "Workflow session ended at can only be set when the session status is Done.",
        );
      }
      clearSingleValue(store, session.id, edgeId(workflow.agentSession.fields.endedAt));
    } else {
      const endedAt = parseOptionalDate(input.endedAt, "Workflow session ended at");
      if (endedAt === null) {
        throw new WorkflowMutationError(
          400,
          "Workflow session ended at must be a valid ISO timestamp when the session is done.",
        );
      }
      patch.endedAt = endedAt ?? session.endedAt ?? new Date();
    }
  } else if (input.endedAt !== undefined) {
    const endedAt = parseOptionalDate(input.endedAt, "Workflow session ended at");
    if (endedAt === null) {
      clearSingleValue(store, session.id, edgeId(workflow.agentSession.fields.endedAt));
    } else if (endedAt) {
      patch.endedAt = endedAt;
    }
  }

  if (Object.keys(patch).length > 0) {
    graph.agentSession.update(session.id, patch);
  }

  return {
    action: input.action,
    created: false,
    summary: buildSessionSummary(graph.agentSession.get(session.id)),
  };
}

export function requestWorkflowCommitUserReview(
  graph: ProductGraphClient,
  store: GraphStore,
  input: CommitUserReviewRequestMutation,
): WorkflowMutationResult {
  const commit = requireCommit(graph, store, requireString(input.commitId, "Commit id"));
  const currentState = decodeWorkflowCommitState(commit.state);
  if (isWorkflowCommitTerminal(currentState)) {
    throw new WorkflowMutationError(
      409,
      `Workflow commit "${commit.id}" does not accept a user-review gate in state "${currentState}".`,
      "invalid-transition",
    );
  }

  const metadata = resolveWorkflowCommitUserReviewMetadataPatch(graph, store, commit.id, input);
  const patch = metadata.patch;
  patch.gate = commitGateIds.UserReview;
  if (Object.keys(patch).length > 0) {
    graph.commit.update(commit.id, patch);
  }
  if (
    metadata.requestedBySession &&
    shouldRecordWorkflowCommitUserReviewDecision({
      commit,
      ...(metadata.reason ? { reason: metadata.reason } : {}),
      ...(metadata.requestedAt ? { requestedAt: metadata.requestedAt } : {}),
      requestedBySession: metadata.requestedBySession,
    })
  ) {
    recordWorkflowCommitUserReviewDecision(graph, {
      commit,
      ...(metadata.reason ? { reason: metadata.reason } : {}),
      ...(metadata.requestedAt ? { requestedAt: metadata.requestedAt } : {}),
      requestedBySession: metadata.requestedBySession,
    });
  }

  return {
    action: input.action,
    created: false,
    summary: buildCommitSummary(graph.commit.get(commit.id)),
  };
}

export function clearWorkflowCommitUserReview(
  graph: ProductGraphClient,
  store: GraphStore,
  input: CommitUserReviewClearMutation,
): WorkflowMutationResult {
  const commit = requireCommit(graph, store, requireString(input.commitId, "Commit id"));

  clearWorkflowCommitUserReviewMetadata(store, commit.id);
  graph.commit.update(commit.id, {
    gate: commitGateIds.None,
  });

  return {
    action: input.action,
    created: false,
    summary: buildCommitSummary(graph.commit.get(commit.id)),
  };
}

export function setWorkflowCommitState(
  graph: ProductGraphClient,
  store: GraphStore,
  input: CommitStateMutation,
): WorkflowMutationResult {
  const commit = requireCommit(graph, store, requireString(input.commitId, "Commit id"));
  const branch = requireBranch(graph, store, commit.branch);
  const currentState = decodeWorkflowCommitState(commit.state);
  const targetState = requireAllowedValue(input.state, commitStateValues, "Workflow commit state");

  requireWorkflowTransition(currentState, targetState, commitTransitions, "Workflow commit");
  if (targetState === "active") {
    requireBranchRepositoryTarget(graph, branch.id);
    requireWorkflowTransition(
      decodeWorkflowBranchState(branch.state),
      "active",
      branchTransitions,
      "Workflow branch",
    );
    if (branch.activeCommit && branch.activeCommit !== commit.id) {
      throw new WorkflowMutationError(
        409,
        `Workflow branch "${branch.id}" is already locked by active commit "${branch.activeCommit}".`,
        "branch-lock-conflict",
      );
    }
    graph.commit.update(commit.id, {
      state: commitStateIds.active,
    });
    graph.branch.update(branch.id, {
      state: branchStateIds.active,
    });
    setSingleValue(store, branch.id, edgeId(workflow.branch.fields.activeCommit), commit.id);
  } else {
    if (targetState === "committed") {
      const repositoryCommit = findRepositoryCommitForWorkflowCommit(graph, commit.id);
      if (!repositoryCommit) {
        throw new WorkflowMutationError(
          409,
          `Workflow commit "${commit.id}" does not have a repository commit result.`,
          "repository-missing",
        );
      }
      if (decodeRepositoryCommitState(repositoryCommit.state) !== "committed") {
        throw new WorkflowMutationError(
          409,
          `Workflow commit "${commit.id}" cannot be marked committed before its repository commit is committed.`,
          "invalid-transition",
        );
      }
    }
    graph.commit.update(commit.id, {
      state: commitStateIds[targetState],
    });
    if (
      branch.activeCommit === commit.id ||
      currentState === "active" ||
      targetState === "blocked" ||
      targetState === "committed" ||
      targetState === "dropped" ||
      decodeWorkflowBranchState(branch.state) === "active" ||
      decodeWorkflowBranchState(branch.state) === "blocked"
    ) {
      reconcileBranchAfterCommitChange(graph, store, branch.id, commit.id);
    }
  }

  return {
    action: input.action,
    created: false,
    summary: buildCommitSummary(graph.commit.get(commit.id)),
  };
}

export function createWorkflowRepositoryCommit(
  graph: ProductGraphClient,
  store: GraphStore,
  input: RepositoryCommitCreateMutation,
): WorkflowMutationResult {
  const repository = requireRepository(
    graph,
    store,
    requireString(input.repositoryId, "Repository id"),
  );
  let commitId: string | undefined;
  let repositoryBranchId: string | undefined;
  let defaultTitle = "Repository commit";

  if (input.commitId) {
    const commit = requireCommit(graph, store, requireString(input.commitId, "Workflow commit id"));
    const branch = requireBranch(graph, store, commit.branch);
    if (branch.project !== repository.project) {
      throw new WorkflowMutationError(
        409,
        `Workflow commit "${commit.id}" does not belong to repository "${repository.id}".`,
        "invalid-transition",
      );
    }
    const managedRepositoryBranch = requireBranchRepositoryTarget(graph, branch.id);
    if (input.repositoryBranchId) {
      const selectedRepositoryBranch = requireRepositoryBranch(
        graph,
        store,
        requireString(input.repositoryBranchId, "Repository branch id"),
      );
      if (selectedRepositoryBranch.id !== managedRepositoryBranch.id) {
        throw new WorkflowMutationError(
          409,
          `Workflow commit "${commit.id}" requires managed repository branch "${managedRepositoryBranch.id}".`,
          "repository-missing",
        );
      }
      repositoryBranchId = selectedRepositoryBranch.id;
    } else {
      repositoryBranchId = managedRepositoryBranch.id;
    }
    const existingRepositoryCommit = findRepositoryCommitForWorkflowCommit(graph, commit.id);
    if (existingRepositoryCommit) {
      throw new WorkflowMutationError(
        409,
        `Workflow commit "${commit.id}" is already attached to repository commit "${existingRepositoryCommit.id}".`,
        "commit-lock-conflict",
      );
    }
    commitId = commit.id;
    defaultTitle = commit.name;
  } else if (input.repositoryBranchId) {
    const repositoryBranch = requireRepositoryBranch(
      graph,
      store,
      requireString(input.repositoryBranchId, "Repository branch id"),
    );
    if (repositoryBranch.repository !== repository.id) {
      throw new WorkflowMutationError(
        409,
        `Repository branch "${repositoryBranch.id}" does not belong to repository "${repository.id}".`,
        "invalid-transition",
      );
    }
    repositoryBranchId = repositoryBranch.id;
  }

  const requestedState =
    input.state === undefined
      ? "planned"
      : requireAllowedValue(input.state, repositoryCommitStateValues, "Repository commit state");
  if (requestedState === "committed") {
    throw new WorkflowMutationError(
      409,
      'Repository commits must be finalized through "finalizeCommit".',
      "invalid-transition",
    );
  }
  const requestedLeaseState = normalizeRepositoryCommitLeaseState(
    requestedState,
    input.worktree?.leaseState === undefined
      ? undefined
      : requireAllowedValue(
          input.worktree.leaseState,
          repositoryCommitLeaseStateValues,
          "Repository commit lease state",
        ),
  );
  const repositoryCommitId = graph.repositoryCommit.create({
    name: trimOptionalString(input.title) ?? defaultTitle,
    repository: repository.id,
    ...(repositoryBranchId ? { repositoryBranch: repositoryBranchId } : {}),
    ...(commitId ? { commit: commitId } : {}),
    state: repositoryCommitStateIds[requestedState],
    worktree: {
      path: trimOptionalString(input.worktree?.path),
      branchName: trimOptionalString(input.worktree?.branchName),
      leaseState: repositoryCommitLeaseStateIds[requestedLeaseState],
    },
  });
  return {
    action: input.action,
    created: true,
    summary: buildRepositoryCommitSummary(graph.repositoryCommit.get(repositoryCommitId)),
  };
}

export function finalizeWorkflowCommit(
  graph: ProductGraphClient,
  store: GraphStore,
  input: CommitFinalizationMutation,
): WorkflowMutationResult {
  const commit = requireCommit(graph, store, requireString(input.commitId, "Workflow commit id"));
  const branch = requireBranch(graph, store, commit.branch);

  if (decodeWorkflowCommitState(commit.state) !== "active") {
    throw new WorkflowMutationError(
      409,
      `Workflow commit "${commit.id}" can only be finalized from "active".`,
      "invalid-transition",
    );
  }

  const repositoryCommitSummary = persistRepositoryCommitFinalization(
    graph,
    store,
    branch,
    commit,
    input,
  );

  graph.commit.update(commit.id, {
    state: commitStateIds[input.outcome],
  });
  advanceBranchAfterCommitFinalization(graph, store, branch.id);

  const finalizedCommit = graph.commit.get(commit.id);
  const finalizedBranch = graph.branch.get(branch.id);

  return {
    action: input.action,
    created: false,
    finalization: {
      branch: buildBranchSummary(graph, finalizedBranch),
      commit: buildCommitSummary(finalizedCommit),
      outcome: input.outcome,
      ...(repositoryCommitSummary ? { repositoryCommit: repositoryCommitSummary } : {}),
    },
    summary: buildCommitSummary(finalizedCommit),
  };
}

export function validateWorkflowBranchStateTransition(
  graph: ProductGraphClient,
  branch: ReturnType<ProductGraphClient["branch"]["get"]>,
  targetState: WorkflowBranchStateValue,
): void {
  const currentState = decodeWorkflowBranchState(branch.state);
  requireWorkflowTransition(currentState, targetState, branchTransitions, "Workflow branch");
  if (targetState === "active") {
    requireBranchRepositoryTarget(graph, branch.id);
  }
  if (targetState !== "active" && branch.activeCommit) {
    throw new WorkflowMutationError(
      409,
      `Workflow branch "${branch.id}" still has active commit "${branch.activeCommit}".`,
      "invalid-transition",
    );
  }
  if (targetState === "done") {
    const commits = listBranchCommits(graph, branch.id);
    if (
      !commits.every((commit) => isWorkflowCommitTerminal(decodeWorkflowCommitState(commit.state)))
    ) {
      throw new WorkflowMutationError(
        409,
        `Workflow branch "${branch.id}" cannot be marked done while it still has open commits.`,
        "invalid-transition",
      );
    }
  }
}
