import type {
  RepositoryBranchSummary,
  RepositoryCommitSummary,
  WorkflowBranchSummary,
  WorkflowCommitSummary,
  WorkflowRepositorySummary,
} from "./command.js";
import type { CommitQueueScopeSessionSummary } from "./query.js";
import { resolveWorkflowSessionKindFromAgentSessionKind } from "./session-append.js";
import type { WorkflowSessionKind } from "./type.js";

export type WorkflowSessionLaunchKind = "planning" | "execution" | "review";

export type WorkflowLaunchSessionKind = Exclude<WorkflowSessionKind, "Merge">;

export const workflowCommitLaunchSelectionStrategies = ["selected-commit-next-runnable"] as const;

export type WorkflowCommitLaunchSelectionStrategy =
  (typeof workflowCommitLaunchSelectionStrategies)[number];

export const workflowCommitLaunchSelectionSources = [
  "active-commit",
  "planned-commit",
  "ready-commit",
  "retained-open-session",
] as const;

export type WorkflowCommitLaunchSelectionSource =
  (typeof workflowCommitLaunchSelectionSources)[number];

export interface WorkflowSessionLaunchContextRecord {
  readonly context: string;
  readonly references: string;
}

export interface WorkflowSessionLaunchBranchContext extends WorkflowSessionLaunchContextRecord {
  readonly name: string;
  readonly slug: string;
}

export interface WorkflowSessionLaunchCommitContext extends WorkflowSessionLaunchContextRecord {
  readonly name: string;
  readonly slug: string;
}

export interface WorkflowSessionLaunchSessionContext extends WorkflowSessionLaunchContextRecord {
  readonly kind: WorkflowLaunchSessionKind;
  readonly name: string;
}

export interface WorkflowSessionLaunchLocalExecutionHints {
  readonly gitBranchName?: string;
  readonly headSha?: string;
  readonly repositoryRoot?: string;
  readonly worktreePath?: string;
}

export interface WorkflowCommitLaunchSelection {
  readonly source: WorkflowCommitLaunchSelectionSource;
  readonly strategy: WorkflowCommitLaunchSelectionStrategy;
  readonly workflowSessionKind: WorkflowLaunchSessionKind;
}

export interface WorkflowSessionLaunchPayload {
  readonly context: {
    readonly branch: WorkflowSessionLaunchBranchContext;
    readonly commit: WorkflowSessionLaunchCommitContext;
    readonly session: WorkflowSessionLaunchSessionContext;
  };
  readonly local?: WorkflowSessionLaunchLocalExecutionHints;
  readonly selection: WorkflowCommitLaunchSelection;
}

export type WorkflowCommitLaunchSubject = {
  readonly branchId: string;
  readonly commitId: string;
  readonly kind: "commit";
};

export type WorkflowCommitSessionLaunchCandidate =
  | {
      readonly kind: WorkflowSessionLaunchKind;
      readonly status: "runnable";
      readonly subject: WorkflowCommitLaunchSubject;
      readonly workflow: WorkflowSessionLaunchPayload;
    }
  | {
      readonly message: string;
      readonly status: "not-runnable";
    };

export interface ResolveWorkflowCommitSessionLaunchCandidateInput {
  readonly branch: WorkflowBranchSummary;
  readonly commit: WorkflowCommitSummary;
  readonly latestSession?: CommitQueueScopeSessionSummary;
  readonly repository?: WorkflowRepositorySummary;
  readonly repositoryBranch?: RepositoryBranchSummary;
  readonly repositoryCommit?: RepositoryCommitSummary;
}

const workflowLaunchSessionKindToLaunchKind = Object.freeze({
  Implement: "execution",
  Plan: "planning",
  Review: "review",
} as const satisfies Record<WorkflowLaunchSessionKind, WorkflowSessionLaunchKind>);

function trimToValue(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function createFallbackContext(entity: "branch" | "commit", name: string): string {
  return entity === "branch"
    ? `No explicit workflow context is recorded for branch "${name}".`
    : `No explicit workflow context is recorded for commit "${name}".`;
}

function stripWorkflowKeyPrefix(key: string | undefined, prefix: string, fallback: string): string {
  const normalized = trimToValue(key);
  if (!normalized) {
    return fallback;
  }
  const expectedPrefix = `${prefix}:`;
  return normalized.startsWith(expectedPrefix)
    ? normalized.slice(expectedPrefix.length)
    : normalized;
}

function uniqueReferenceLines(values: readonly (string | undefined)[]): string {
  const references = values.flatMap((value) => {
    const trimmed = trimToValue(value);
    return trimmed ? [trimmed] : [];
  });
  return Array.from(new Set(references)).join("\n");
}

function createBranchContext(branch: WorkflowBranchSummary): WorkflowSessionLaunchBranchContext {
  const name = trimToValue(branch.title) ?? branch.id;
  return {
    context:
      trimToValue(branch.context) ??
      trimToValue(branch.contextSummary) ??
      createFallbackContext("branch", name),
    name,
    references:
      trimToValue(branch.references) ??
      uniqueReferenceLines([
        `workflow.branch.id=${branch.id}`,
        `workflow.branch.key=${branch.branchKey}`,
        branch.contextDocumentId
          ? `workflow.branch.contextDocument=${branch.contextDocumentId}`
          : undefined,
        branch.goalDocumentId ? `workflow.branch.goalDocument=${branch.goalDocumentId}` : undefined,
      ]),
    slug: stripWorkflowKeyPrefix(branch.branchKey, "branch", branch.id),
  };
}

function createCommitContext(commit: WorkflowCommitSummary): WorkflowSessionLaunchCommitContext {
  const name = trimToValue(commit.title) ?? commit.id;
  return {
    context:
      trimToValue(commit.context) ??
      trimToValue(commit.contextSummary) ??
      createFallbackContext("commit", name),
    name,
    references:
      trimToValue(commit.references) ??
      uniqueReferenceLines([
        `workflow.commit.id=${commit.id}`,
        `workflow.commit.key=${commit.commitKey}`,
        commit.contextDocumentId
          ? `workflow.commit.contextDocument=${commit.contextDocumentId}`
          : undefined,
        commit.parentCommitId ? `workflow.commit.parent=${commit.parentCommitId}` : undefined,
      ]),
    slug: stripWorkflowKeyPrefix(commit.commitKey, "commit", commit.id),
  };
}

function describeWorkflowSessionKind(kind: WorkflowLaunchSessionKind): string {
  switch (kind) {
    case "Implement":
      return "implementation";
    case "Plan":
      return "planning";
    case "Review":
      return "review";
  }
}

function createSessionContext(input: {
  readonly branch: WorkflowBranchSummary;
  readonly commit: WorkflowCommitSummary;
  readonly latestSession?: CommitQueueScopeSessionSummary;
  readonly source: WorkflowCommitLaunchSelectionSource;
  readonly workflowSessionKind: WorkflowLaunchSessionKind;
}): WorkflowSessionLaunchSessionContext {
  const commitName = trimToValue(input.commit.title) ?? input.commit.id;
  const branchName = trimToValue(input.branch.title) ?? input.branch.id;
  const sessionLabel = describeWorkflowSessionKind(input.workflowSessionKind);
  const verb = input.source === "retained-open-session" ? "Resume" : "Run";
  const fallbackContext = `${verb} the ${sessionLabel} session for commit "${commitName}" on branch "${branchName}".`;
  const fallbackName = `${input.workflowSessionKind} ${commitName}`;
  const fallbackReferences = uniqueReferenceLines([
    `workflow.session.kind=${input.workflowSessionKind}`,
    `workflow.session.source=${input.source}`,
    `workflow.branch.key=${input.branch.branchKey}`,
    `workflow.commit.key=${input.commit.commitKey}`,
  ]);

  return {
    context: trimToValue(input.latestSession?.context) ?? fallbackContext,
    kind: input.workflowSessionKind,
    name: trimToValue(input.latestSession?.title) ?? fallbackName,
    references: trimToValue(input.latestSession?.references) ?? fallbackReferences,
  };
}

function createLocalExecutionHints(input: {
  readonly repository?: WorkflowRepositorySummary;
  readonly repositoryBranch?: RepositoryBranchSummary;
  readonly repositoryCommit?: RepositoryCommitSummary;
}): WorkflowSessionLaunchLocalExecutionHints | undefined {
  const gitBranchName =
    input.repositoryCommit?.worktree.branchName ?? input.repositoryBranch?.branchName;
  const headSha = input.repositoryCommit?.sha ?? input.repositoryBranch?.headSha;
  const repositoryRoot = input.repository?.repoRoot;
  const worktreePath =
    input.repositoryCommit?.worktree.path ?? input.repositoryBranch?.worktreePath;

  if (!gitBranchName && !headSha && !repositoryRoot && !worktreePath) {
    return undefined;
  }

  return {
    ...(gitBranchName ? { gitBranchName } : {}),
    ...(headSha ? { headSha } : {}),
    ...(repositoryRoot ? { repositoryRoot } : {}),
    ...(worktreePath ? { worktreePath } : {}),
  };
}

function isOpenRetainedSession(session: CommitQueueScopeSessionSummary | undefined): boolean {
  return (
    session?.runtimeState === "running" ||
    session?.runtimeState === "awaiting-user-input" ||
    session?.runtimeState === "blocked"
  );
}

function resolveNewSessionSelection(commit: WorkflowCommitSummary):
  | {
      readonly kind: WorkflowSessionLaunchKind;
      readonly source: WorkflowCommitLaunchSelectionSource;
      readonly workflowSessionKind: WorkflowLaunchSessionKind;
    }
  | undefined {
  switch (commit.state) {
    case "active":
      return {
        kind: "execution",
        source: "active-commit",
        workflowSessionKind: "Implement",
      };
    case "ready":
      return {
        kind: "execution",
        source: "ready-commit",
        workflowSessionKind: "Implement",
      };
    case "planned":
      return {
        kind: "planning",
        source: "planned-commit",
        workflowSessionKind: "Plan",
      };
    default:
      return undefined;
  }
}

function resolveRetainedOpenSessionSelection(session: CommitQueueScopeSessionSummary): {
  readonly kind: WorkflowSessionLaunchKind;
  readonly source: WorkflowCommitLaunchSelectionSource;
  readonly workflowSessionKind: WorkflowLaunchSessionKind;
} {
  return {
    kind: session.kind,
    source: "retained-open-session",
    workflowSessionKind: resolveWorkflowSessionKindFromAgentSessionKind(session.kind),
  };
}

export function resolveWorkflowCommitSessionLaunchCandidate(
  input: ResolveWorkflowCommitSessionLaunchCandidateInput,
): WorkflowCommitSessionLaunchCandidate {
  if (input.commit.gate === "UserReview") {
    return {
      message:
        trimToValue(input.commit.gateReason) ??
        "This commit is waiting on explicit user review before workflow can continue.",
      status: "not-runnable",
    };
  }

  const openRetainedSession = isOpenRetainedSession(input.latestSession)
    ? input.latestSession
    : undefined;
  const selection = openRetainedSession
    ? resolveRetainedOpenSessionSelection(openRetainedSession)
    : resolveNewSessionSelection(input.commit);

  if (!selection) {
    switch (input.commit.state) {
      case "blocked":
        return {
          message:
            trimToValue(input.commit.gateReason) ??
            "Blocked commits do not accept workflow sessions until the block is cleared.",
          status: "not-runnable",
        };
      case "committed":
        return {
          message: "Committed commits do not accept more workflow sessions.",
          status: "not-runnable",
        };
      case "dropped":
        return {
          message: "Dropped commits do not accept workflow sessions.",
          status: "not-runnable",
        };
      default:
        return {
          message: "The selected commit does not expose a runnable workflow session.",
          status: "not-runnable",
        };
    }
  }

  const local = createLocalExecutionHints({
    repository: input.repository,
    repositoryBranch: input.repositoryBranch,
    repositoryCommit: input.repositoryCommit,
  });

  const workflow = {
    context: {
      branch: createBranchContext(input.branch),
      commit: createCommitContext(input.commit),
      session: createSessionContext({
        branch: input.branch,
        commit: input.commit,
        latestSession: openRetainedSession,
        source: selection.source,
        workflowSessionKind: selection.workflowSessionKind,
      }),
    },
    ...(local ? { local } : {}),
    selection: {
      source: selection.source,
      strategy: "selected-commit-next-runnable" as const,
      workflowSessionKind: selection.workflowSessionKind,
    },
  } satisfies WorkflowSessionLaunchPayload;

  return {
    kind: selection.kind,
    status: "runnable",
    subject: {
      branchId: input.branch.id,
      commitId: input.commit.id,
      kind: "commit",
    },
    workflow,
  };
}

export function resolveWorkflowSessionLaunchKind(
  kind: WorkflowLaunchSessionKind,
): WorkflowSessionLaunchKind {
  return workflowLaunchSessionKindToLaunchKind[kind];
}
