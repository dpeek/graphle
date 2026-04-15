import type {
  CommitQueueScopeSessionKind,
  DecisionWriteResult,
  WorkflowCommitSummary,
  WorkflowMutableSessionKind,
  WorkflowMutationResult,
  WorkflowSessionSummary,
} from "@dpeek/graphle-module-workflow";
import { workflowCommitUserReviewContract } from "@dpeek/graphle-module-workflow";

import { webGraphCommandsPath } from "./auth-client.js";
import type {
  DecisionWriteWebAppAuthorityCommand,
  WorkflowMutationWebAppAuthorityCommand,
} from "./authority.js";

type WebCommandFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type WorkflowReviewFollowOnSessionKind = Extract<
  WorkflowMutableSessionKind,
  "Plan" | "Review"
>;

type WorkflowReviewCommitRef = Pick<WorkflowCommitSummary, "commitKey" | "id" | "title">;

export type ContinueWorkflowCommitUserReviewInput = {
  readonly commit: WorkflowReviewCommitRef;
  readonly gateReason?: string;
  readonly sessionId: string;
  readonly fetcher?: WebCommandFetch;
};

export type ContinueWorkflowCommitUserReviewResult = {
  readonly commit: WorkflowCommitSummary;
  readonly decision: DecisionWriteResult["decision"];
};

export type RequestWorkflowCommitChangesInput = {
  readonly commit: WorkflowReviewCommitRef;
  readonly followOnKind: WorkflowReviewFollowOnSessionKind;
  readonly gateReason?: string;
  readonly sessionId: string;
  readonly fetcher?: WebCommandFetch;
};

export type RequestWorkflowCommitChangesResult = {
  readonly decision: DecisionWriteResult["decision"];
  readonly session: WorkflowSessionSummary;
};

type ReviewCommand = DecisionWriteWebAppAuthorityCommand | WorkflowMutationWebAppAuthorityCommand;

function readCommandError(
  status: number,
  statusText: string,
  payload: unknown,
  fallback: string,
): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }
  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof (payload as { message?: unknown }).message === "string"
  ) {
    return (payload as { message: string }).message;
  }
  return `${fallback} (${status} ${statusText}).`;
}

async function postWorkflowReviewCommand<TResult>(
  command: ReviewCommand,
  input: {
    readonly fallback: string;
    readonly fetcher?: WebCommandFetch;
  },
): Promise<TResult> {
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(webGraphCommandsPath, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(command),
  });

  const payload = (await response.json().catch(() => undefined)) as TResult | { error?: string };
  if (!response.ok) {
    throw new Error(
      readCommandError(response.status, response.statusText, payload, input.fallback),
    );
  }

  return payload as TResult;
}

function requireCommitSummary(summary: WorkflowMutationResult["summary"]): WorkflowCommitSummary {
  if (summary.entity !== "commit") {
    throw new Error(
      `Expected workflow mutation to return a commit summary, received "${summary.entity}".`,
    );
  }
  return summary;
}

function requireSessionSummary(summary: WorkflowMutationResult["summary"]): WorkflowSessionSummary {
  if (summary.entity !== "session") {
    throw new Error(
      `Expected workflow mutation to return a session summary, received "${summary.entity}".`,
    );
  }
  return summary;
}

function trimOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeWorkflowKeySegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : "workflow";
}

function createRequestChangesSessionKey(
  commit: WorkflowReviewCommitRef,
  kind: WorkflowReviewFollowOnSessionKind,
): string {
  const commitSlug = normalizeWorkflowKeySegment(commit.commitKey.replace(/^commit:/, ""));
  return `session:${commitSlug}-${kind.toLowerCase()}-follow-up-${Date.now()}`;
}

function createContinueDecisionDetails(input: {
  readonly commit: WorkflowReviewCommitRef;
  readonly gateReason?: string;
}): string {
  const details = [
    `Clear the explicit user-review gate for commit "${input.commit.title}" (${input.commit.commitKey}) and continue workflow.`,
    trimOptionalString(input.gateReason)
      ? `Gate reason: ${trimOptionalString(input.gateReason)}`
      : undefined,
  ].filter((value): value is string => Boolean(value));
  return details.join(" ");
}

function createRequestChangesDecisionDetails(input: {
  readonly commit: WorkflowReviewCommitRef;
  readonly followOnKind: WorkflowReviewFollowOnSessionKind;
  readonly gateReason?: string;
}): string {
  const details = [
    `Keep commit "${input.commit.title}" (${input.commit.commitKey}) paused in the explicit user-review gate.`,
    `Queue a follow-on ${input.followOnKind.toLowerCase()} session.`,
    trimOptionalString(input.gateReason)
      ? `Gate reason: ${trimOptionalString(input.gateReason)}`
      : undefined,
  ].filter((value): value is string => Boolean(value));
  return details.join(" ");
}

function createFollowOnSessionContext(input: {
  readonly commit: WorkflowReviewCommitRef;
  readonly followOnKind: WorkflowReviewFollowOnSessionKind;
}): string {
  return `Follow up on the browser review request for commit "${input.commit.title}" while the explicit user-review gate remains active.`;
}

function createFollowOnSessionReferences(input: {
  readonly commit: WorkflowReviewCommitRef;
  readonly sessionId: string;
}): string {
  return [
    `workflow.commit.id=${input.commit.id}`,
    `workflow.commit.key=${input.commit.commitKey}`,
    `workflow.review.action=request-changes`,
    `workflow.review.requestedBySessionId=${input.sessionId}`,
  ].join("\n");
}

export function resolveWorkflowReviewFollowOnSessionKind(
  sessionKind: CommitQueueScopeSessionKind | undefined,
): WorkflowReviewFollowOnSessionKind {
  return sessionKind === "planning" ? "Plan" : "Review";
}

export async function continueWorkflowCommitUserReview(
  input: ContinueWorkflowCommitUserReviewInput,
): Promise<ContinueWorkflowCommitUserReviewResult> {
  const decision = await postWorkflowReviewCommand<DecisionWriteResult>(
    {
      kind: "decision-write",
      input: {
        decision: {
          details: createContinueDecisionDetails(input),
          kind: "resolution",
          summary: "Continue workflow",
        },
        sessionId: input.sessionId,
      },
    },
    {
      fallback: "Continue workflow decision write failed",
      fetcher: input.fetcher,
    },
  );

  const cleared = await postWorkflowReviewCommand<WorkflowMutationResult>(
    {
      kind: "workflow-mutation",
      input: {
        action: workflowCommitUserReviewContract.mutations.clear,
        commitId: input.commit.id,
      },
    },
    {
      fallback: "Continue workflow gate clear failed",
      fetcher: input.fetcher,
    },
  );

  return {
    commit: requireCommitSummary(cleared.summary),
    decision: decision.decision,
  };
}

export async function requestWorkflowCommitChanges(
  input: RequestWorkflowCommitChangesInput,
): Promise<RequestWorkflowCommitChangesResult> {
  const decision = await postWorkflowReviewCommand<DecisionWriteResult>(
    {
      kind: "decision-write",
      input: {
        decision: {
          details: createRequestChangesDecisionDetails(input),
          kind: "blocker",
          summary: "Request changes",
        },
        sessionId: input.sessionId,
      },
    },
    {
      fallback: "Request changes decision write failed",
      fetcher: input.fetcher,
    },
  );

  const session = await postWorkflowReviewCommand<WorkflowMutationResult>(
    {
      kind: "workflow-mutation",
      input: {
        action: "createSession",
        commitId: input.commit.id,
        context: createFollowOnSessionContext(input),
        kind: input.followOnKind,
        name: `Workflow ${input.followOnKind.toLowerCase()} follow-up`,
        references: createFollowOnSessionReferences(input),
        sessionKey: createRequestChangesSessionKey(input.commit, input.followOnKind),
        workerId: "browser-review-gate",
      },
    },
    {
      fallback: "Request changes follow-on session creation failed",
      fetcher: input.fetcher,
    },
  );

  return {
    decision: decision.decision,
    session: requireSessionSummary(session.summary),
  };
}
