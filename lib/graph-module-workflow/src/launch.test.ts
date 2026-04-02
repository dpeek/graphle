import { describe, expect, it } from "bun:test";

import type {
  RepositoryBranchSummary,
  RepositoryCommitSummary,
  WorkflowBranchSummary,
  WorkflowCommitSummary,
  WorkflowRepositorySummary,
} from "./command.js";
import { resolveWorkflowCommitSessionLaunchCandidate } from "./launch.js";
import type { CommitQueueScopeSessionSummary } from "./query.js";

function createBranchSummary(
  overrides: Partial<WorkflowBranchSummary> = {},
): WorkflowBranchSummary {
  return {
    activeCommitId: "commit:1",
    branchKey: "branch:workflow-runtime",
    context: "Launch the browser-first workflow session from the main branch record.",
    contextDocumentId: "document:branch-context",
    contextSummary: "Primary branch startup memory.",
    createdAt: "2026-04-01T00:00:00.000Z",
    entity: "branch",
    goalDocumentId: "document:branch-goal",
    goalSummary: "Keep the browser workflow route commit-first.",
    id: "branch:1",
    projectId: "project:1",
    queueRank: 1,
    references: "lib/graph-module-workflow/doc/workflow-model.md\nnote: main stays implicit",
    state: "active",
    title: "Workflow runtime",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function createCommitSummary(
  overrides: Partial<WorkflowCommitSummary> = {},
): WorkflowCommitSummary {
  return {
    branchId: "branch:1",
    commitKey: "commit:workflow-runtime-contract",
    context: "Carry explicit branch, commit, and session context through browser launch.",
    contextDocumentId: "document:commit-context",
    contextSummary: "Carry the explicit workflow launch payload through the browser.",
    createdAt: "2026-04-01T00:00:00.000Z",
    entity: "commit",
    id: "commit:1",
    order: 1,
    references:
      "lib/cli/src/browser-agent/server.ts\nlib/app/src/web/lib/workflow-session-history.ts",
    state: "planned",
    title: "Define workflow launch contract",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function createRepositorySummary(
  overrides: Partial<WorkflowRepositorySummary> = {},
): WorkflowRepositorySummary {
  return {
    createdAt: "2026-04-01T00:00:00.000Z",
    defaultBaseBranch: "main",
    entity: "repository",
    id: "repo:1",
    mainRemoteName: "origin",
    projectId: "project:1",
    repoRoot: "/workspace/io",
    repositoryKey: "repo:io",
    title: "io",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function createRepositoryBranchSummary(
  overrides: Partial<RepositoryBranchSummary> = {},
): RepositoryBranchSummary {
  return {
    baseBranchName: "main",
    branchId: "branch:1",
    branchName: "workflow/runtime",
    createdAt: "2026-04-01T00:00:00.000Z",
    entity: "repository-branch",
    headSha: "abc1234",
    id: "repo-branch:1",
    latestReconciledAt: "2026-04-01T00:00:00.000Z",
    managed: true,
    projectId: "project:1",
    repositoryId: "repo:1",
    title: "workflow/runtime",
    updatedAt: "2026-04-01T00:00:00.000Z",
    worktreePath: "/tmp/worktree-1",
    ...overrides,
  };
}

function createRepositoryCommitSummary(
  overrides: Partial<RepositoryCommitSummary> = {},
): RepositoryCommitSummary {
  return {
    commitId: "commit:1",
    createdAt: "2026-04-01T00:00:00.000Z",
    entity: "repository-commit",
    id: "repo-commit:1",
    repositoryBranchId: "repo-branch:1",
    repositoryId: "repo:1",
    sha: "def5678",
    state: "attached",
    title: "Define workflow launch contract",
    updatedAt: "2026-04-01T00:00:00.000Z",
    worktree: {
      branchName: "workflow/runtime",
      leaseState: "attached",
      path: "/tmp/worktree-1",
    },
    ...overrides,
  };
}

function createLatestSession(
  overrides: Partial<CommitQueueScopeSessionSummary> = {},
): CommitQueueScopeSessionSummary {
  return {
    context: "Resume the retained implementation session with the existing launch contract.",
    references: "note: reuse retained session context directly",
    id: "session:1",
    kind: "execution",
    runtimeState: "running",
    sessionKey: "session:workflow-runtime",
    startedAt: "2026-04-01T00:00:00.000Z",
    subject: {
      commitId: "commit:1",
      kind: "commit",
    },
    title: "Implement workflow launch contract",
    ...overrides,
  };
}

describe("workflow launch contract", () => {
  it("builds a planning launch candidate with explicit workflow context and local hints", () => {
    const candidate = resolveWorkflowCommitSessionLaunchCandidate({
      branch: createBranchSummary(),
      commit: createCommitSummary(),
      repository: createRepositorySummary(),
      repositoryBranch: createRepositoryBranchSummary(),
    });

    expect(candidate).toMatchObject({
      kind: "planning",
      status: "runnable",
      subject: {
        branchId: "branch:1",
        commitId: "commit:1",
        kind: "commit",
      },
      workflow: {
        context: {
          branch: {
            context: "Launch the browser-first workflow session from the main branch record.",
            name: "Workflow runtime",
            references:
              "lib/graph-module-workflow/doc/workflow-model.md\nnote: main stays implicit",
            slug: "workflow-runtime",
          },
          commit: {
            context: "Carry explicit branch, commit, and session context through browser launch.",
            name: "Define workflow launch contract",
            references:
              "lib/cli/src/browser-agent/server.ts\nlib/app/src/web/lib/workflow-session-history.ts",
            slug: "workflow-runtime-contract",
          },
          session: {
            context:
              'Run the planning session for commit "Define workflow launch contract" on branch "Workflow runtime".',
            kind: "Plan",
            name: "Plan Define workflow launch contract",
          },
        },
        local: {
          gitBranchName: "workflow/runtime",
          headSha: "abc1234",
          repositoryRoot: "/workspace/io",
          worktreePath: "/tmp/worktree-1",
        },
        selection: {
          source: "planned-commit",
          strategy: "selected-commit-next-runnable",
          workflowSessionKind: "Plan",
        },
      },
    });
  });

  it("reuses the retained open session kind when the selected commit already has one", () => {
    const candidate = resolveWorkflowCommitSessionLaunchCandidate({
      branch: createBranchSummary(),
      commit: createCommitSummary({ state: "active" }),
      latestSession: createLatestSession(),
      repositoryCommit: createRepositoryCommitSummary(),
    });

    expect(candidate).toMatchObject({
      kind: "execution",
      status: "runnable",
      workflow: {
        selection: {
          source: "retained-open-session",
          workflowSessionKind: "Implement",
        },
        context: {
          session: {
            context:
              "Resume the retained implementation session with the existing launch contract.",
            kind: "Implement",
            name: "Implement workflow launch contract",
            references: "note: reuse retained session context directly",
          },
        },
        local: {
          gitBranchName: "workflow/runtime",
          headSha: "def5678",
          worktreePath: "/tmp/worktree-1",
        },
      },
    });
  });

  it("returns a non-runnable result when the commit is paused for user review", () => {
    const candidate = resolveWorkflowCommitSessionLaunchCandidate({
      branch: createBranchSummary(),
      commit: createCommitSummary({
        gate: "UserReview",
        gateReason: "Wait for an operator decision before implementation continues.",
        state: "ready",
      }),
    });

    expect(candidate).toEqual({
      message: "Wait for an operator decision before implementation continues.",
      status: "not-runnable",
    });
  });
});
