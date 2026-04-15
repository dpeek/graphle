import { edgeId } from "@dpeek/graphle-kernel";
import type { GraphCommandSpec } from "@dpeek/graphle-module";

import {
  agentSession,
  branch,
  commit,
  project,
  repository,
  workflowV1Commit,
  workflowV1CommitGateValues,
} from "./type.js";

export const branchStateValues = [
  "backlog",
  "ready",
  "active",
  "blocked",
  "done",
  "archived",
] as const;

export type WorkflowBranchStateValue = (typeof branchStateValues)[number];

export const commitStateValues = [
  "planned",
  "ready",
  "active",
  "blocked",
  "committed",
  "dropped",
] as const;

export type WorkflowCommitStateValue = (typeof commitStateValues)[number];

export const workflowCommitGateValues = workflowV1CommitGateValues;

export type WorkflowCommitGateValue = (typeof workflowCommitGateValues)[number];

export type WorkflowCommitUserReviewGateMetadataInput = {
  readonly reason?: string | null;
  readonly requestedAt?: string | null;
  readonly requestedBySessionId?: string | null;
};

export const workflowCommitUserReviewContract = Object.freeze({
  auditTrail: {
    request: {
      gateMutation: "requestCommitUserReview" as const,
      retainedDecisionKind: "blocker" as const,
    },
    continueCommand: "workflow:decision-write",
    requestChanges: {
      decisionCommand: "workflow:decision-write",
      followOnSessionMutation: "createSession",
      gateMutation: "none",
      retainedSessionHistoryCommand: "workflow:agent-session-append",
    },
  },
  gate: "UserReview" as const,
  metadataFields: workflowV1Commit.gateMetadataFields,
  mutations: {
    clear: "clearCommitUserReview" as const,
    request: "requestCommitUserReview" as const,
  },
});

// Session mutation stays aligned with retained AgentSession storage for the
// first browser milestone, so the write surface keeps the v1 kinds that map
// cleanly today and defers Todo/Merge until native session storage lands.
export const workflowMutableSessionKindValues = ["Plan", "Review", "Implement"] as const;

export type WorkflowMutableSessionKind = (typeof workflowMutableSessionKindValues)[number];

export const workflowMutableSessionStatusValues = ["Open", "Done"] as const;

export type WorkflowMutableSessionStatus = (typeof workflowMutableSessionStatusValues)[number];

export const repositoryCommitStateValues = [
  "planned",
  "reserved",
  "attached",
  "committed",
  "observed",
] as const;

export type RepositoryCommitStateValue = (typeof repositoryCommitStateValues)[number];

export const repositoryCommitLeaseStateValues = [
  "unassigned",
  "reserved",
  "attached",
  "released",
] as const;

export type RepositoryCommitLeaseStateValue = (typeof repositoryCommitLeaseStateValues)[number];

export const workflowCommitFinalizationOutcomeValues = ["committed", "blocked", "dropped"] as const;

export type WorkflowCommitFinalizationOutcome =
  (typeof workflowCommitFinalizationOutcomeValues)[number];

export const workflowMutationFailureCodes = [
  "repository-missing",
  "branch-lock-conflict",
  "commit-lock-conflict",
  "invalid-transition",
  "subject-not-found",
] as const;

export type WorkflowMutationFailureCode = (typeof workflowMutationFailureCodes)[number];

type WorkflowSummaryBase = {
  readonly createdAt: string;
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
};

export type WorkflowProjectSummary = WorkflowSummaryBase & {
  readonly entity: "project";
  readonly inferred: boolean;
  readonly projectKey: string;
};

export type WorkflowRepositorySummary = WorkflowSummaryBase & {
  readonly defaultBaseBranch: string;
  readonly entity: "repository";
  readonly mainRemoteName?: string;
  readonly projectId: string;
  readonly repoRoot: string;
  readonly repositoryKey: string;
};

export type WorkflowBranchSummary = WorkflowSummaryBase & {
  readonly activeCommitId?: string;
  readonly branchKey: string;
  readonly context?: string;
  readonly references?: string;
  readonly contextSummary?: string;
  readonly entity: "branch";
  readonly contextDocumentId?: string;
  readonly goalDocumentId?: string;
  readonly goalSummary?: string;
  readonly projectId: string;
  readonly queueRank?: number;
  readonly state: WorkflowBranchStateValue;
};

export type WorkflowCommitSummary = WorkflowSummaryBase & {
  readonly branchId: string;
  readonly commitKey: string;
  readonly context?: string;
  readonly references?: string;
  readonly contextSummary?: string;
  readonly contextDocumentId?: string;
  readonly entity: "commit";
  readonly gate?: WorkflowCommitGateValue;
  readonly gateReason?: string;
  readonly gateRequestedAt?: string;
  readonly gateRequestedBySessionId?: string;
  readonly order: number;
  readonly parentCommitId?: string;
  readonly state: WorkflowCommitStateValue;
};

export type WorkflowSessionSummary = WorkflowSummaryBase & {
  readonly branchId: string;
  readonly commitId: string;
  readonly context?: string;
  readonly references?: string;
  readonly endedAt?: string;
  readonly entity: "session";
  readonly kind: WorkflowMutableSessionKind;
  readonly projectId: string;
  readonly repositoryId?: string;
  readonly sessionKey: string;
  readonly startedAt: string;
  readonly status: WorkflowMutableSessionStatus;
  readonly threadId?: string;
  readonly turnId?: string;
  readonly workerId: string;
};

export type RepositoryBranchSummary = WorkflowSummaryBase & {
  readonly baseBranchName: string;
  readonly branchName: string;
  readonly entity: "repository-branch";
  readonly headSha?: string;
  readonly latestReconciledAt?: string;
  readonly managed: boolean;
  readonly projectId: string;
  readonly repositoryId: string;
  readonly upstreamName?: string;
  readonly branchId?: string;
  readonly worktreePath?: string;
};

export type RepositoryCommitSummary = WorkflowSummaryBase & {
  readonly entity: "repository-commit";
  readonly committedAt?: string;
  readonly repositoryBranchId?: string;
  readonly repositoryId: string;
  readonly sha?: string;
  readonly state: RepositoryCommitStateValue;
  readonly commitId?: string;
  readonly worktree: {
    readonly branchName?: string;
    readonly leaseState: RepositoryCommitLeaseStateValue;
    readonly path?: string;
  };
};

export type WorkflowMutationSummary =
  | WorkflowProjectSummary
  | WorkflowRepositorySummary
  | WorkflowBranchSummary
  | WorkflowCommitSummary
  | WorkflowSessionSummary
  | RepositoryBranchSummary
  | RepositoryCommitSummary;

type WorkflowRepositoryWorktreeInput = {
  readonly branchName?: string | null;
  readonly leaseState?: RepositoryCommitLeaseStateValue;
  readonly path?: string | null;
};

type WorkflowCommitFinalizationGitResultBase = {
  readonly repositoryBranchId?: string | null;
  readonly repositoryCommitId?: string;
  readonly title?: string | null;
  readonly worktree?: WorkflowRepositoryWorktreeInput;
};

export type WorkflowCommitCommittedGitResult = WorkflowCommitFinalizationGitResultBase & {
  readonly committedAt?: string;
  readonly sha: string;
};

export type WorkflowCommitNonCommittedGitResult = WorkflowCommitFinalizationGitResultBase;

export type WorkflowCommitFinalizationRequest =
  | {
      readonly commitId: string;
      readonly git: WorkflowCommitCommittedGitResult;
      readonly outcome: "committed";
    }
  | {
      readonly commitId: string;
      readonly git?: WorkflowCommitNonCommittedGitResult;
      readonly outcome: Exclude<WorkflowCommitFinalizationOutcome, "committed">;
    };

export type WorkflowCommitFinalizationAcknowledgement = {
  readonly branch: WorkflowBranchSummary;
  readonly commit: WorkflowCommitSummary;
  readonly outcome: WorkflowCommitFinalizationOutcome;
  readonly repositoryCommit?: RepositoryCommitSummary;
};

export type WorkflowCommitFinalizationAction = {
  readonly action: "finalizeCommit";
} & WorkflowCommitFinalizationRequest;

export type WorkflowCreateProjectAction = {
  readonly action: "createProject";
  readonly inferred?: boolean;
  readonly projectKey: string;
  readonly title: string;
};

export type WorkflowUpdateProjectAction = {
  readonly action: "updateProject";
  readonly inferred?: boolean;
  readonly projectId: string;
  readonly projectKey?: string;
  readonly title?: string;
};

export type WorkflowProjectMutationAction =
  | WorkflowCreateProjectAction
  | WorkflowUpdateProjectAction;

export type WorkflowCreateRepositoryAction = {
  readonly action: "createRepository";
  readonly defaultBaseBranch: string;
  readonly mainRemoteName?: string | null;
  readonly projectId: string;
  readonly repoRoot: string;
  readonly repositoryKey: string;
  readonly title: string;
};

export type WorkflowUpdateRepositoryAction = {
  readonly action: "updateRepository";
  readonly defaultBaseBranch?: string;
  readonly mainRemoteName?: string | null;
  readonly repoRoot?: string;
  readonly repositoryId: string;
  readonly repositoryKey?: string;
  readonly title?: string;
};

export type WorkflowRepositoryMutationAction =
  | WorkflowCreateRepositoryAction
  | WorkflowUpdateRepositoryAction;

// Branch records stay typed in v1 because the graph still persists the
// singleton visible branch plus its prompt context, even though the browser
// milestone is now commit-first.
export type WorkflowCreateBranchAction = {
  readonly action: "createBranch";
  readonly branchKey: string;
  readonly context?: string | null;
  readonly contextDocumentId?: string | null;
  readonly goalDocumentId?: string | null;
  readonly projectId: string;
  readonly queueRank?: number | null;
  readonly references?: string | null;
  readonly state?: Extract<WorkflowBranchStateValue, "backlog" | "ready">;
  readonly title: string;
};

export type WorkflowUpdateBranchAction = {
  readonly action: "updateBranch";
  readonly branchId: string;
  readonly branchKey?: string;
  readonly context?: string | null;
  readonly contextDocumentId?: string | null;
  readonly goalDocumentId?: string | null;
  readonly queueRank?: number | null;
  readonly references?: string | null;
  readonly title?: string;
};

export type WorkflowBranchMutationAction = WorkflowCreateBranchAction | WorkflowUpdateBranchAction;

// These actions remain only to bridge the broader pre-v1 branch contract while
// authority handlers still derive branch lifecycle and repository targeting.
export type WorkflowSetBranchStateAction = {
  readonly action: "setBranchState";
  readonly branchId: string;
  readonly state: WorkflowBranchStateValue;
};

export type WorkflowAttachBranchRepositoryTargetAction = {
  readonly action: "attachBranchRepositoryTarget";
  readonly baseBranchName: string;
  readonly branchId: string;
  readonly branchName: string;
  readonly headSha?: string | null;
  readonly latestReconciledAt?: string | null;
  readonly repositoryBranchId?: string;
  readonly repositoryId: string;
  readonly title?: string;
  readonly upstreamName?: string | null;
  readonly worktreePath?: string | null;
};

export type WorkflowTransitionalBranchMutationAction =
  | WorkflowSetBranchStateAction
  | WorkflowAttachBranchRepositoryTargetAction;

export type WorkflowCreateCommitAction = {
  readonly action: "createCommit";
  readonly branchId: string;
  readonly commitKey: string;
  readonly context?: string | null;
  readonly contextDocumentId?: string | null;
  readonly order: number;
  readonly parentCommitId?: string | null;
  readonly references?: string | null;
  readonly state?: Extract<WorkflowCommitStateValue, "planned" | "ready">;
  readonly title: string;
};

export type WorkflowUpdateCommitAction = {
  readonly action: "updateCommit";
  readonly commitId: string;
  readonly commitKey?: string;
  readonly context?: string | null;
  readonly contextDocumentId?: string | null;
  readonly order?: number;
  readonly parentCommitId?: string | null;
  readonly references?: string | null;
  readonly title?: string;
};

export type WorkflowSetCommitStateAction = {
  readonly action: "setCommitState";
  readonly commitId: string;
  readonly state: WorkflowCommitStateValue;
};

export type WorkflowCommitMutationAction =
  | WorkflowCreateCommitAction
  | WorkflowUpdateCommitAction
  | WorkflowSetCommitStateAction;

export type WorkflowRequestCommitUserReviewAction = {
  readonly action: "requestCommitUserReview";
  readonly commitId: string;
} & WorkflowCommitUserReviewGateMetadataInput;

export type WorkflowClearCommitUserReviewAction = {
  readonly action: "clearCommitUserReview";
  readonly commitId: string;
};

export type WorkflowCommitUserReviewGateMutationAction =
  | WorkflowRequestCommitUserReviewAction
  | WorkflowClearCommitUserReviewAction;

export type WorkflowCreateSessionAction = {
  readonly action: "createSession";
  readonly commitId: string;
  readonly context?: string | null;
  readonly endedAt?: string | null;
  readonly kind: WorkflowMutableSessionKind;
  readonly name: string;
  readonly references?: string | null;
  readonly sessionKey: string;
  readonly startedAt?: string;
  readonly status?: WorkflowMutableSessionStatus;
  readonly threadId?: string | null;
  readonly turnId?: string | null;
  readonly workerId: string;
};

export type WorkflowUpdateSessionAction = {
  readonly action: "updateSession";
  readonly context?: string | null;
  readonly endedAt?: string | null;
  readonly name?: string;
  readonly references?: string | null;
  readonly sessionId: string;
  readonly status?: WorkflowMutableSessionStatus;
  readonly threadId?: string | null;
  readonly turnId?: string | null;
};

export type WorkflowSessionMutationAction =
  | WorkflowCreateSessionAction
  | WorkflowUpdateSessionAction;

// Repository-commit creation stays runtime-only while local git realization
// remains an authority concern rather than part of the operator-facing v1
// workflow contract.
export type WorkflowCreateRepositoryCommitAction = {
  readonly action: "createRepositoryCommit";
  readonly repositoryBranchId?: string | null;
  readonly repositoryId: string;
  readonly state?: Exclude<RepositoryCommitStateValue, "committed">;
  readonly title?: string | null;
  readonly commitId?: string;
  readonly worktree?: WorkflowRepositoryWorktreeInput;
};

export type WorkflowRuntimeMutationAction = WorkflowCreateRepositoryCommitAction;

export type WorkflowMutationAction =
  | WorkflowProjectMutationAction
  | WorkflowRepositoryMutationAction
  | WorkflowBranchMutationAction
  | WorkflowTransitionalBranchMutationAction
  | WorkflowCommitMutationAction
  | WorkflowCommitUserReviewGateMutationAction
  | WorkflowSessionMutationAction
  | WorkflowRuntimeMutationAction
  | WorkflowCommitFinalizationAction;

type WorkflowMutationBaseResult = {
  readonly action: WorkflowMutationAction["action"];
  readonly created: boolean;
  cursor?: string;
  replayed?: boolean;
  readonly summary: WorkflowMutationSummary;
};

export type WorkflowCommitFinalizationResult = WorkflowMutationBaseResult & {
  readonly action: "finalizeCommit";
  readonly finalization: WorkflowCommitFinalizationAcknowledgement;
  readonly summary: WorkflowCommitSummary;
};

export type WorkflowMutationResult = WorkflowMutationBaseResult | WorkflowCommitFinalizationResult;

export const workflowMutationCommand = {
  key: "workflow:mutation",
  label: "Mutate workflow state",
  execution: "serverOnly",
  input: undefined as unknown as WorkflowMutationAction,
  output: undefined as unknown as WorkflowMutationResult,
  policy: {
    touchesPredicates: [
      { predicateId: edgeId(project.fields.projectKey) },
      { predicateId: edgeId(repository.fields.repositoryKey) },
      { predicateId: edgeId(branch.fields.state) },
      { predicateId: edgeId(branch.fields.context) },
      { predicateId: edgeId(branch.fields.references) },
      { predicateId: edgeId(branch.fields.goalDocument) },
      { predicateId: edgeId(branch.fields.contextDocument) },
      { predicateId: edgeId(branch.fields.activeCommit) },
      { predicateId: edgeId(commit.fields.context) },
      { predicateId: edgeId(commit.fields.references) },
      { predicateId: edgeId(commit.fields.contextDocument) },
      { predicateId: edgeId(commit.fields.gate) },
      { predicateId: edgeId(commit.fields.state) },
      { predicateId: edgeId(commit.fields.gateReason) },
      { predicateId: edgeId(commit.fields.gateRequestedAt) },
      { predicateId: edgeId(commit.fields.gateRequestedBySessionId) },
      { predicateId: edgeId(agentSession.fields.sessionKey) },
      { predicateId: edgeId(agentSession.fields.kind) },
      { predicateId: edgeId(agentSession.fields.runtimeState) },
      { predicateId: edgeId(agentSession.fields.context) },
      { predicateId: edgeId(agentSession.fields.references) },
      { predicateId: edgeId(agentSession.fields.commit) },
    ],
  },
} satisfies GraphCommandSpec<WorkflowMutationAction, WorkflowMutationResult>;
