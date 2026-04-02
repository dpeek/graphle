import { describe, expect, it } from "bun:test";

import {
  browserAgentActiveSessionPath,
  browserAgentHealthPath,
  browserAgentLaunchPath,
  browserAgentSessionEventsPath,
  observeBrowserAgentSessionEvents,
  probeBrowserAgentRuntime,
  requestBrowserAgentActiveSessionLookup,
  requestBrowserAgentHealth,
  requestBrowserAgentLaunch,
  type BrowserAgentActiveSessionLookupResult,
  type BrowserAgentHealthResponse,
  type CodexSessionLaunchResult,
} from "./transport.js";

describe("browser-agent transport", () => {
  it("requests health from the shipped local runtime path", async () => {
    const payload = {
      ok: true,
      runtime: {
        activeSessionLookupPath: browserAgentActiveSessionPath,
        launchPath: browserAgentLaunchPath,
        sessionEventsPath: browserAgentSessionEventsPath,
        startedAt: "2026-03-26T02:00:00.000Z",
        status: "ready",
        statusMessage: "Browser-agent runtime ready.",
        version: 1,
      },
    } satisfies BrowserAgentHealthResponse;

    const response = await requestBrowserAgentHealth({
      fetch: async (input, init) => {
        expect(input).toBe(`http://127.0.0.1:4317${browserAgentHealthPath}`);
        expect(init?.method).toBe("GET");
        return Response.json(payload);
      },
    });

    expect(response).toEqual(payload);
  });

  it("posts launch requests to the local browser-agent runtime", async () => {
    const payload = {
      ok: true,
      outcome: "launched",
      session: {
        id: "session:1",
        kind: "execution",
        runtimeState: "starting",
        sessionKey: "session:key:1",
        startedAt: "2026-03-26T02:00:00.000Z",
        subject: {
          kind: "branch",
          branchId: "branch:1",
        },
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
        auditActorPrincipalId: "principal:1",
        appendGrant: {
          allowedActions: ["append-session-events", "write-artifact", "write-decision"],
          expiresAt: "2026-03-26T03:00:00.000Z",
          grantId: "grant:1",
          grantToken: "grant-token:1",
          issuedAt: "2026-03-26T02:00:00.000Z",
          sessionId: "session:1",
        },
      },
    } satisfies CodexSessionLaunchResult;

    const response = await requestBrowserAgentLaunch(
      {
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
      },
      {
        fetch: async (input, init) => {
          expect(input).toBe(`http://127.0.0.1:4317${browserAgentLaunchPath}`);
          expect(init?.method).toBe("POST");
          expect(JSON.parse(String(init?.body))).toEqual({
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
          });
          return Response.json(payload);
        },
      },
    );

    expect(response).toEqual(payload);
  });

  it("posts explicit commit workflow payloads for the next runnable session", async () => {
    await requestBrowserAgentLaunch(
      {
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
        workflow: {
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
            repositoryRoot: "/workspace/io",
            worktreePath: "/tmp/worktree-1",
          },
          selection: {
            source: "planned-commit",
            strategy: "selected-commit-next-runnable",
            workflowSessionKind: "Plan",
          },
        },
      },
      {
        fetch: async (_input, init) => {
          expect(JSON.parse(String(init?.body))).toEqual({
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
            workflow: {
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
          return Response.json({
            code: "local-bridge-unavailable",
            message: "The local browser-agent runtime is unavailable.",
            ok: false,
            retryable: true,
            source: "browser",
          } satisfies CodexSessionLaunchResult);
        },
      },
    );
  });

  it("posts active-session lookups to the local runtime", async () => {
    const payload = {
      ok: true,
      found: true,
      session: {
        id: "session:1",
        kind: "execution",
        runtimeState: "running",
        sessionKey: "session:key:1",
        startedAt: "2026-03-26T02:00:00.000Z",
        subject: {
          kind: "commit",
          branchId: "branch:1",
          commitId: "commit:1",
        },
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
    } satisfies BrowserAgentActiveSessionLookupResult;

    const response = await requestBrowserAgentActiveSessionLookup(
      {
        actor: {
          principalId: "principal:1",
          sessionId: "session:web:1",
          surface: "browser",
        },
        kind: "execution",
        projectId: "project:1",
        subject: {
          kind: "commit",
          branchId: "branch:1",
          commitId: "commit:1",
        },
      },
      {
        fetch: async (input, init) => {
          expect(input).toBe(`http://127.0.0.1:4317${browserAgentActiveSessionPath}`);
          expect(init?.method).toBe("POST");
          return Response.json(payload);
        },
      },
    );

    expect(response).toEqual(payload);
  });

  it("posts active-session lookups with the explicit workflow payload when commit launch selection is known", async () => {
    await requestBrowserAgentActiveSessionLookup(
      {
        actor: {
          principalId: "principal:1",
          sessionId: "session:web:1",
          surface: "browser",
        },
        kind: "execution",
        projectId: "project:1",
        subject: {
          kind: "commit",
          branchId: "branch:1",
          commitId: "commit:1",
        },
        workflow: {
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
                'Resume the implementation session for commit "Define workflow launch contract" on branch "Workflow runtime".',
              kind: "Implement",
              name: "Implement Define workflow launch contract",
              references: "workflow.session.kind=Implement",
            },
          },
          selection: {
            source: "retained-open-session",
            strategy: "selected-commit-next-runnable",
            workflowSessionKind: "Implement",
          },
        },
      },
      {
        fetch: async (_input, init) => {
          expect(JSON.parse(String(init?.body))).toEqual({
            actor: {
              principalId: "principal:1",
              sessionId: "session:web:1",
              surface: "browser",
            },
            kind: "execution",
            projectId: "project:1",
            subject: {
              kind: "commit",
              branchId: "branch:1",
              commitId: "commit:1",
            },
            workflow: {
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
                    'Resume the implementation session for commit "Define workflow launch contract" on branch "Workflow runtime".',
                  kind: "Implement",
                  name: "Implement Define workflow launch contract",
                  references: "workflow.session.kind=Implement",
                },
              },
              selection: {
                source: "retained-open-session",
                strategy: "selected-commit-next-runnable",
                workflowSessionKind: "Implement",
              },
            },
          });
          return Response.json({
            found: false,
            ok: true,
          } satisfies BrowserAgentActiveSessionLookupResult);
        },
      },
    );
  });

  it("streams local session events from the browser-agent runtime", async () => {
    const received: unknown[] = [];

    await observeBrowserAgentSessionEvents(
      {
        attach: {
          attachToken: "attach:1",
          browserAgentSessionId: "browser-agent:1",
          expiresAt: "2026-03-26T03:00:00.000Z",
          transport: "browser-agent-http",
        },
        sessionId: "session:1",
      },
      {
        fetch: async (input, init) => {
          expect(input).toBe(`http://127.0.0.1:4317${browserAgentSessionEventsPath}`);
          expect(init?.method).toBe("POST");
          expect(JSON.parse(String(init?.body))).toEqual({
            attach: {
              attachToken: "attach:1",
              browserAgentSessionId: "browser-agent:1",
              expiresAt: "2026-03-26T03:00:00.000Z",
              transport: "browser-agent-http",
            },
            sessionId: "session:1",
          });

          return new Response(
            [
              JSON.stringify({
                browserAgentSessionId: "browser-agent:1",
                event: {
                  type: "session",
                  phase: "started",
                  sequence: 1,
                  timestamp: "2026-03-26T02:00:00.000Z",
                },
                sessionId: "session:1",
                type: "event",
              }),
              JSON.stringify({
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
              }),
            ].join("\n"),
            {
              headers: {
                "content-type": "application/x-ndjson",
              },
            },
          );
        },
        onEvent: (message) => {
          received.push(message);
        },
      },
    );

    expect(received).toEqual([
      {
        browserAgentSessionId: "browser-agent:1",
        event: {
          type: "session",
          phase: "started",
          sequence: 1,
          timestamp: "2026-03-26T02:00:00.000Z",
        },
        sessionId: "session:1",
        type: "event",
      },
      {
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
      },
    ]);
  });

  it("reports explicit unavailable runtime state when the localhost bridge is down", async () => {
    const probe = await probeBrowserAgentRuntime({
      fetch: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    });

    expect(probe).toEqual({
      message:
        "Local browser-agent runtime unavailable. Start `io browser-agent` on this machine to enable browser launch and attach.",
      status: "unavailable",
    });
  });
});
