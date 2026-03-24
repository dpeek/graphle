import { describe, expect, it } from "bun:test";

import type { AuthorizationContext } from "@io/core/graph";

import { type WebAppAuthority, WebAppAuthorityWorkflowReadError } from "./authority.js";
import { handleWorkflowReadRequest } from "./server-routes.js";

const authorization: AuthorizationContext = {
  graphId: "graph:test",
  principalId: "principal:test",
  principalKind: "service",
  sessionId: "session:test",
  roleKeys: ["graph:authority"],
  capabilityGrantIds: [],
  capabilityVersion: 0,
  policyVersion: 0,
};

function createWorkflowReadAuthority(
  overrides: {
    readonly readProjectBranchScope?: WebAppAuthority["readProjectBranchScope"];
    readonly readCommitQueueScope?: WebAppAuthority["readCommitQueueScope"];
  } = {},
): WebAppAuthority {
  return {
    readProjectBranchScope:
      overrides.readProjectBranchScope ??
      (() => {
        throw new Error("Unexpected project branch scope read.");
      }),
    readCommitQueueScope:
      overrides.readCommitQueueScope ??
      (() => {
        throw new Error("Unexpected commit queue scope read.");
      }),
  } as unknown as WebAppAuthority;
}

describe("workflow read server routes", () => {
  it("rejects malformed JSON bodies", async () => {
    const response = await handleWorkflowReadRequest(
      new Request("https://web.local/api/workflow-read", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "{not-json",
      }),
      createWorkflowReadAuthority(),
      authorization,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Request body must be valid JSON.",
    });
  });

  it("fails clearly when workflow read inputs are missing required fields", async () => {
    const response = await handleWorkflowReadRequest(
      new Request("https://web.local/api/workflow-read", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          kind: "project-branch-scope",
          query: {
            limit: 5,
          },
        }),
      }),
      createWorkflowReadAuthority(),
      authorization,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Workflow read request "query.projectId" must be a non-empty string.',
    });
  });

  it("fails clearly when branch board ordering inputs are malformed", async () => {
    const response = await handleWorkflowReadRequest(
      new Request("https://web.local/api/workflow-read", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          kind: "project-branch-scope",
          query: {
            projectId: "project:io",
            order: [{ field: "rank", direction: "desc" }],
          },
        }),
      }),
      createWorkflowReadAuthority(),
      authorization,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error:
        'Workflow read request "query.order"[0].field must be one of: queue-rank, updated-at, created-at, title, state.',
    });
  });

  it("maps stable workflow read failures onto the HTTP response", async () => {
    const response = await handleWorkflowReadRequest(
      new Request("https://web.local/api/workflow-read", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          kind: "commit-queue-scope",
          query: {
            branchId: "branch:missing",
          },
        }),
      }),
      createWorkflowReadAuthority({
        readCommitQueueScope() {
          throw new WebAppAuthorityWorkflowReadError(
            404,
            "branch-not-found",
            'Workflow branch "branch:missing" was not found in the current projection.',
          );
        },
      }),
      authorization,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'Workflow branch "branch:missing" was not found in the current projection.',
      code: "branch-not-found",
    });
  });
});
