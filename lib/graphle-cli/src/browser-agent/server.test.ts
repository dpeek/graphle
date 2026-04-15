import { describe, expect, it } from "bun:test";

import type { ValidationResult, Workflow } from "../agent/types.js";
import { browserAgentSessionEventsPath } from "./transport.js";
import {
  createBrowserAgentServer,
  parseBrowserAgentCliArgs,
  type BrowserAgentLaunchCoordinator,
} from "./server.js";

function createWorkflowResult(): ValidationResult<Workflow> {
  return {
    ok: true,
    value: {
      agent: {
        maxConcurrentAgents: 1,
        maxRetryBackoffMs: 1,
        maxTurns: 1,
      },
      codex: {
        approvalPolicy: "never",
        command: "codex",
        readTimeoutMs: 1,
        stallTimeoutMs: 1,
        threadSandbox: "workspace-write",
        turnTimeoutMs: 1,
      },
      context: {
        docs: {},
        overrides: {},
        profiles: {},
      },
      entrypoint: {
        configPath: "/tmp/graphle.ts",
        kind: "graphle",
        promptPath: "/tmp/graphle.md",
      },
      entrypointContent: "prompt",
      hooks: {
        timeoutMs: 1,
      },
      issues: {
        defaultAgent: "execute",
        defaultProfile: "execute",
        routing: [],
      },
      modules: {},
      polling: {
        intervalMs: 1,
      },
      tracker: {
        activeStates: [],
        endpoint: "https://linear.local",
        kind: "linear",
        terminalStates: [],
      },
      tui: {
        graph: {
          kind: "http",
        },
        initialScope: {},
      },
      workspace: {
        root: "/tmp/workspace",
      },
    },
  };
}

describe("browser-agent server", () => {
  it("parses host, port, and workflow path CLI arguments", () => {
    expect(parseBrowserAgentCliArgs(["./graphle.ts", "--host", "0.0.0.0", "--port", "8123"])).toEqual({
      help: false,
      host: "0.0.0.0",
      port: 8123,
      workflowPath: "./graphle.ts",
    });
  });

  it("reports an unavailable runtime when the launch coordinator is missing", async () => {
    const server = createBrowserAgentServer(createWorkflowResult(), {
      now: () => new Date("2026-03-26T02:00:00.000Z"),
    });
    const response = await server.fetch(new Request("http://127.0.0.1:4317/health"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      runtime: {
        activeSessionLookupPath: "/active-session",
        launchPath: "/launch-session",
        sessionEventsPath: browserAgentSessionEventsPath,
        startedAt: "2026-03-26T02:00:00.000Z",
        status: "unavailable",
        statusMessage:
          "No shared workflow launch coordinator is configured for the local browser-agent runtime.",
        version: 1,
      },
    });
  });

  it("routes launch and active-session requests through the shared coordinator", async () => {
    const calls: string[] = [];
    const coordinator: BrowserAgentLaunchCoordinator = {
      async launchSession(request) {
        calls.push(`launch:${request.subject.kind}:${request.projectId}`);
        return {
          ok: true,
          outcome: "attached",
          session: {
            id: "session:1",
            kind: request.kind,
            runtimeState: "running",
            sessionKey: "session:key:1",
            startedAt: "2026-03-26T02:00:00.000Z",
            subject: request.subject,
          },
          attach: {
            attachToken: "attach:1",
            browserAgentSessionId: "browser-agent:1",
            expiresAt: "2026-03-26T03:00:00.000Z",
            transport: "browser-agent-http",
          },
          workspace: {
            repositoryId: "repo:1",
          },
          authority: {
            auditActorPrincipalId: request.actor.principalId,
            appendGrant: {
              allowedActions: ["append-session-events", "write-artifact", "write-decision"],
              expiresAt: "2026-03-26T03:00:00.000Z",
              grantId: "grant:1",
              grantToken: "grant-token:1",
              issuedAt: "2026-03-26T02:00:00.000Z",
              sessionId: "session:1",
            },
          },
        };
      },
      async lookupActiveSession(request) {
        calls.push(`lookup:${request.subject.kind}:${request.projectId}`);
        return {
          ok: true,
          found: false,
        };
      },
      async observeSessionEvents(request, observer) {
        calls.push(`stream:${request.sessionId}:${request.attach.browserAgentSessionId}`);
        observer({
          browserAgentSessionId: request.attach.browserAgentSessionId,
          event: {
            type: "session",
            phase: "started",
            sequence: 1,
            timestamp: "2026-03-26T02:00:00.000Z",
          },
          sessionId: request.sessionId,
          type: "event",
        });
      },
    };
    const server = createBrowserAgentServer(createWorkflowResult(), {
      coordinator,
      now: () => new Date("2026-03-26T02:00:00.000Z"),
    });

    const launchResponse = await server.fetch(
      new Request("http://127.0.0.1:4317/launch-session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actor: {
            principalId: "principal:1",
            sessionId: "session:web:1",
            surface: "browser",
          },
          kind: "execution",
          projectId: "project:1",
          subject: {
            kind: "branch",
            branchId: "branch:1",
          },
        }),
      }),
    );
    const lookupResponse = await server.fetch(
      new Request("http://127.0.0.1:4317/active-session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actor: {
            principalId: "principal:1",
            sessionId: "session:web:1",
            surface: "browser",
          },
          kind: "execution",
          projectId: "project:1",
          subject: {
            kind: "branch",
            branchId: "branch:1",
          },
        }),
      }),
    );

    expect(launchResponse.status).toBe(200);
    expect((await launchResponse.json()) as { outcome: string }).toMatchObject({
      outcome: "attached",
      ok: true,
    });
    expect(lookupResponse.status).toBe(200);
    expect(await lookupResponse.json()).toEqual({
      ok: true,
      found: false,
    });
    expect(calls).toEqual(["launch:branch:project:1", "lookup:branch:project:1"]);
  });

  it("parses explicit commit workflow payloads on launch and active-session lookup", async () => {
    const launchRequests: unknown[] = [];
    const lookupRequests: unknown[] = [];
    const coordinator: BrowserAgentLaunchCoordinator = {
      async launchSession(request) {
        launchRequests.push(request);
        return {
          ok: true,
          outcome: "launched",
          session: {
            id: "session:1",
            kind: request.kind,
            runtimeState: "starting",
            sessionKey: "session:key:1",
            startedAt: "2026-03-26T02:00:00.000Z",
            subject: request.subject,
          },
          attach: {
            attachToken: "attach:1",
            browserAgentSessionId: "browser-agent:1",
            expiresAt: "2026-03-26T03:00:00.000Z",
            transport: "browser-agent-http",
          },
          workspace: {
            repositoryId: "repo:1",
          },
          authority: {
            auditActorPrincipalId: request.actor.principalId,
            appendGrant: {
              allowedActions: ["append-session-events", "write-artifact", "write-decision"],
              expiresAt: "2026-03-26T03:00:00.000Z",
              grantId: "grant:1",
              grantToken: "grant-token:1",
              issuedAt: "2026-03-26T02:00:00.000Z",
              sessionId: "session:1",
            },
          },
        };
      },
      async lookupActiveSession(request) {
        lookupRequests.push(request);
        return {
          ok: true,
          found: false,
        };
      },
      async observeSessionEvents() {
        throw new Error("not implemented");
      },
    };
    const server = createBrowserAgentServer(createWorkflowResult(), {
      coordinator,
      now: () => new Date("2026-03-26T02:00:00.000Z"),
    });

    const workflowPayload = {
      context: {
        branch: {
          context: "Primary branch startup memory.",
          name: "Workflow runtime",
          references: "workflow.branch.key=branch:workflow-runtime",
          slug: "workflow-runtime",
        },
        commit: {
          context: "Carry the explicit workflow launch payload through the browser.",
          name: "Define workflow launch contract",
          references: "workflow.commit.key=commit:workflow-runtime-contract",
          slug: "workflow-runtime-contract",
        },
        session: {
          context:
            'Run the planning session for commit "Define workflow launch contract" on branch "Workflow runtime".',
          kind: "Plan",
          name: "Plan Define workflow launch contract",
          references: "workflow.session.kind=Plan",
        },
      },
      local: {
        gitBranchName: "workflow/runtime",
        headSha: "abc1234",
        repositoryRoot: "/workspace/graphle",
        worktreePath: "/tmp/worktree-1",
      },
      selection: {
        source: "planned-commit",
        strategy: "selected-commit-next-runnable",
        workflowSessionKind: "Plan",
      },
    } as const;

    await server.fetch(
      new Request("http://127.0.0.1:4317/launch-session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actor: {
            principalId: "principal:1",
            sessionId: "session:web:1",
            surface: "browser",
          },
          kind: "planning",
          projectId: "project:1",
          subject: {
            kind: "commit",
            branchId: "branch:1",
            commitId: "commit:1",
          },
          workflow: workflowPayload,
        }),
      }),
    );
    await server.fetch(
      new Request("http://127.0.0.1:4317/active-session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actor: {
            principalId: "principal:1",
            sessionId: "session:web:1",
            surface: "browser",
          },
          kind: "planning",
          projectId: "project:1",
          subject: {
            kind: "commit",
            branchId: "branch:1",
            commitId: "commit:1",
          },
          workflow: workflowPayload,
        }),
      }),
    );

    expect(launchRequests).toMatchObject([
      {
        kind: "planning",
        subject: {
          kind: "commit",
          branchId: "branch:1",
          commitId: "commit:1",
        },
        workflow: workflowPayload,
      },
    ]);
    expect(lookupRequests).toMatchObject([
      {
        kind: "planning",
        subject: {
          kind: "commit",
          branchId: "branch:1",
          commitId: "commit:1",
        },
        workflow: workflowPayload,
      },
    ]);
  });

  it("streams session events through the shared coordinator", async () => {
    const coordinator: BrowserAgentLaunchCoordinator = {
      async launchSession() {
        throw new Error("not implemented");
      },
      async lookupActiveSession() {
        return {
          ok: true,
          found: false,
        };
      },
      async observeSessionEvents(request, observer) {
        observer({
          browserAgentSessionId: request.attach.browserAgentSessionId,
          event: {
            type: "session",
            phase: "started",
            sequence: 1,
            timestamp: "2026-03-26T02:00:00.000Z",
          },
          sessionId: request.sessionId,
          type: "event",
        });
        observer({
          browserAgentSessionId: request.attach.browserAgentSessionId,
          event: {
            type: "status",
            code: "ready",
            format: "line",
            sequence: 2,
            text: "Running",
            timestamp: "2026-03-26T02:00:01.000Z",
          },
          sessionId: request.sessionId,
          type: "event",
        });
      },
    };
    const server = createBrowserAgentServer(createWorkflowResult(), {
      coordinator,
      now: () => new Date("2026-03-26T02:00:00.000Z"),
    });

    const response = await server.fetch(
      new Request(`http://127.0.0.1:4317${browserAgentSessionEventsPath}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          attach: {
            attachToken: "attach:1",
            browserAgentSessionId: "browser-agent:1",
            expiresAt: "2026-03-26T03:00:00.000Z",
            transport: "browser-agent-http",
          },
          sessionId: "session:1",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(
      `${JSON.stringify({
        browserAgentSessionId: "browser-agent:1",
        event: {
          type: "session",
          phase: "started",
          sequence: 1,
          timestamp: "2026-03-26T02:00:00.000Z",
        },
        sessionId: "session:1",
        type: "event",
      })}\n${JSON.stringify({
        browserAgentSessionId: "browser-agent:1",
        event: {
          type: "status",
          code: "ready",
          format: "line",
          sequence: 2,
          text: "Running",
          timestamp: "2026-03-26T02:00:01.000Z",
        },
        sessionId: "session:1",
        type: "event",
      })}\n`,
    );
  });
});
