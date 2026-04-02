import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { webGraphCommandsPath } from "./auth-client.js";
import {
  continueWorkflowCommitUserReview,
  requestWorkflowCommitChanges,
  resolveWorkflowReviewFollowOnSessionKind,
} from "./workflow-review-actions.js";

type FetchCall = {
  readonly init?: RequestInit;
  readonly input: string;
};

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
    },
    status,
  });
}

function parseCommand(call: FetchCall): unknown {
  if (typeof call.init?.body !== "string") {
    throw new Error("Expected fetch body to be a JSON string.");
  }
  return JSON.parse(call.init.body);
}

describe("workflow review actions", () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let calls: FetchCall[];
  let responses: Response[];

  beforeEach(() => {
    calls = [];
    responses = [];
    Date.now = () => 1_700_000_000_000;
    globalThis.fetch = (async (input, init) => {
      calls.push({
        init,
        input: String(input),
      });
      const response = responses.shift();
      if (!response) {
        throw new Error("Unexpected workflow review command fetch.");
      }
      return response;
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  });

  it("maps planning follow-on work back to a Plan session", () => {
    expect(resolveWorkflowReviewFollowOnSessionKind("planning")).toBe("Plan");
    expect(resolveWorkflowReviewFollowOnSessionKind("review")).toBe("Review");
    expect(resolveWorkflowReviewFollowOnSessionKind("execution")).toBe("Review");
    expect(resolveWorkflowReviewFollowOnSessionKind(undefined)).toBe("Review");
  });

  it("records a continue decision before clearing the user-review gate", async () => {
    responses.push(
      createJsonResponse({
        decision: {
          id: "decision:continue",
          sessionId: "session:review:1",
          sessionKey: "session:review:1",
          summary: "Continue workflow",
        },
      }),
    );
    responses.push(
      createJsonResponse({
        action: "clearCommitUserReview",
        created: false,
        summary: {
          entity: "commit",
          id: "commit-1",
          commitKey: "commit:review-layout",
          branchId: "branch-1",
          createdAt: "2026-04-01T00:00:00.000Z",
          order: 1,
          state: "active",
          title: "Build workflow review layout",
          updatedAt: "2026-04-01T00:05:00.000Z",
        },
      }),
    );

    const result = await continueWorkflowCommitUserReview({
      commit: {
        commitKey: "commit:review-layout",
        id: "commit-1",
        title: "Build workflow review layout",
      },
      gateReason: "Await manual review before implementation resumes.",
      sessionId: "session:review:1",
    });

    expect(result).toMatchObject({
      commit: {
        entity: "commit",
        id: "commit-1",
      },
      decision: {
        id: "decision:continue",
        sessionId: "session:review:1",
        sessionKey: "session:review:1",
      },
    });
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.input)).toEqual([webGraphCommandsPath, webGraphCommandsPath]);
    expect(parseCommand(calls[0]!)).toEqual({
      kind: "decision-write",
      input: {
        decision: {
          details: expect.stringContaining("Clear the explicit user-review gate"),
          kind: "resolution",
          summary: "Continue workflow",
        },
        sessionId: "session:review:1",
      },
    });
    expect(parseCommand(calls[1]!)).toEqual({
      kind: "workflow-mutation",
      input: {
        action: "clearCommitUserReview",
        commitId: "commit-1",
      },
    });
  });

  it("records a request-changes decision and queues follow-on review work", async () => {
    responses.push(
      createJsonResponse({
        decision: {
          id: "decision:changes",
          sessionId: "session:review:1",
          sessionKey: "session:review:1",
          summary: "Request changes",
        },
      }),
    );
    responses.push(
      createJsonResponse({
        action: "createSession",
        created: true,
        summary: {
          entity: "session",
          id: "session-2",
          branchId: "branch-1",
          commitId: "commit-1",
          createdAt: "2026-04-01T00:10:00.000Z",
          kind: "Review",
          projectId: "project-1",
          sessionKey: "session:review-layout-review-follow-up-1700000000000",
          startedAt: "2026-04-01T00:10:00.000Z",
          status: "Open",
          title: "Workflow review follow-up",
          updatedAt: "2026-04-01T00:10:00.000Z",
          workerId: "browser-review-gate",
        },
      }),
    );

    const result = await requestWorkflowCommitChanges({
      commit: {
        commitKey: "commit:review-layout",
        id: "commit-1",
        title: "Build workflow review layout",
      },
      followOnKind: "Review",
      gateReason: "Await manual review before implementation resumes.",
      sessionId: "session:review:1",
    });

    expect(result).toMatchObject({
      decision: {
        id: "decision:changes",
        sessionId: "session:review:1",
        sessionKey: "session:review:1",
      },
      session: {
        entity: "session",
        id: "session-2",
        kind: "Review",
        sessionKey: "session:review-layout-review-follow-up-1700000000000",
      },
    });
    expect(calls).toHaveLength(2);
    expect(parseCommand(calls[0]!)).toEqual({
      kind: "decision-write",
      input: {
        decision: {
          details: expect.stringContaining("Queue a follow-on review session."),
          kind: "blocker",
          summary: "Request changes",
        },
        sessionId: "session:review:1",
      },
    });
    expect(parseCommand(calls[1]!)).toEqual({
      kind: "workflow-mutation",
      input: {
        action: "createSession",
        commitId: "commit-1",
        context: expect.stringContaining("Follow up on the browser review request"),
        kind: "Review",
        name: "Workflow review follow-up",
        references: [
          "workflow.commit.id=commit-1",
          "workflow.commit.key=commit:review-layout",
          "workflow.review.action=request-changes",
          "workflow.review.requestedBySessionId=session:review:1",
        ].join("\n"),
        sessionKey: "session:review-layout-review-follow-up-1700000000000",
        workerId: "browser-review-gate",
      },
    });
  });
});
