import { describe, expect, it } from "bun:test";

import {
  createModuleReadScopeRequest,
  defineModuleReadScopeDefinition,
} from "@dpeek/graphle-projection";

import { createModuleLiveScopeRefreshController } from "./refresh-controller.js";

function createScopeDefinition() {
  return defineModuleReadScopeDefinition({
    kind: "module",
    moduleId: "module:test",
    scopeId: "scope:test",
    definitionHash: "scope-def:test:v1",
  });
}

function createSyncState() {
  const scopeDefinition = createScopeDefinition();
  const scopeRequest = createModuleReadScopeRequest(scopeDefinition);
  return {
    cursor: "cursor:initial",
    requestedScope: scopeRequest,
    scope: scopeRequest,
  };
}

describe("module live scope refresh controller", () => {
  it("registers and removes live scopes against the generic live route", async () => {
    const state = createSyncState();
    const controller = createModuleLiveScopeRefreshController(
      {
        getState: () => state,
        sync: async () => ({
          cursor: state.cursor,
          mode: "incremental",
          scope: state.scope,
        }),
      },
      createScopeDefinition(),
      {
        fetch: async (input, init) => {
          expect(input).toBe("/api/live");
          const payload = JSON.parse(String(init?.body));
          if (payload.kind === "register") {
            expect(payload).toMatchObject({
              cursor: state.cursor,
              kind: "register",
            });
            return Response.json({
              kind: "register",
              result: {
                definitionHash: "scope-def:test:v1",
                dependencyKeys: ["dependency:test"],
                expiresAt: "2026-03-24T00:01:00.000Z",
                principalId: "principal:test",
                policyFilterVersion: "policy:0",
                registrationId: "registration:test",
                scopeId: "scope:test",
                sessionId: "session:test",
              },
            });
          }
          expect(payload).toMatchObject({
            kind: "remove",
            scopeId: "scope:test",
          });
          return Response.json({
            kind: "remove",
            result: {
              removed: true,
              scopeId: "scope:test",
              sessionId: "session:test",
            },
          });
        },
      },
    );

    const registration = await controller.register();
    expect(registration).toMatchObject({
      registrationId: "registration:test",
      scopeId: "scope:test",
      sessionId: "session:test",
    });

    const removed = await controller.remove();
    expect(removed).toMatchObject({
      removed: true,
      scopeId: "scope:test",
      sessionId: "session:test",
    });
  });

  it("re-registers and refreshes after an inactive pull", async () => {
    const state = createSyncState();
    const syncCalls: string[] = [];
    const controller = createModuleLiveScopeRefreshController(
      {
        getState: () => state,
        sync: async () => {
          syncCalls.push("sync");
          return {
            cursor: "cursor:refreshed",
            mode: "incremental",
            scope: state.scope,
          };
        },
      },
      createScopeDefinition(),
      {
        fetch: async (_input, init) => {
          const payload = JSON.parse(String(init?.body));
          if (payload.kind === "pull") {
            return Response.json({
              kind: "pull",
              result: {
                active: false,
                invalidations: [],
                scopeId: "scope:test",
                sessionId: "session:test",
              },
            });
          }
          if (payload.kind === "register") {
            return Response.json({
              kind: "register",
              result: {
                definitionHash: "scope-def:test:v1",
                dependencyKeys: ["dependency:test"],
                expiresAt: "2026-03-24T00:01:00.000Z",
                principalId: "principal:test",
                policyFilterVersion: "policy:0",
                registrationId: "registration:test",
                scopeId: "scope:test",
                sessionId: "session:test",
              },
            });
          }
          throw new Error(`Unexpected request kind: ${payload.kind}`);
        },
      },
    );

    const result = await controller.poll();
    expect(result.action).toBe("reregister-and-scoped-refresh");
    expect(syncCalls).toEqual(["sync"]);
    expect(result.registration).toMatchObject({
      registrationId: "registration:test",
      scopeId: "scope:test",
    });
    expect(result.syncResult).toMatchObject({
      cursor: "cursor:refreshed",
      mode: "incremental",
    });
  });
});
