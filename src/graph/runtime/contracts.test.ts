import { describe, expect, it } from "bun:test";

import {
  defineWebPrincipalBootstrapPayload,
  defineWebPrincipalSession,
  defineWebPrincipalSummary,
} from "./contracts.js";

describe("web principal bootstrap contracts", () => {
  it("defines the minimal ready-session bootstrap payload for an authenticated principal", () => {
    const payload = defineWebPrincipalBootstrapPayload({
      session: {
        authState: "ready",
        sessionId: "session-1",
        principalId: "principal-1",
        capabilityVersion: 3,
        displayName: "Operator",
      },
      principal: {
        graphId: "graph:global",
        principalId: "principal-1",
        principalKind: "human",
        roleKeys: ["graph:member"],
        capabilityGrantIds: ["grant-1"],
        access: {
          authority: false,
          graphMember: true,
          sharedRead: false,
        },
        capabilityVersion: 3,
        policyVersion: 5,
      },
    });

    expect(payload).toEqual({
      session: {
        authState: "ready",
        sessionId: "session-1",
        principalId: "principal-1",
        capabilityVersion: 3,
        displayName: "Operator",
      },
      principal: {
        graphId: "graph:global",
        principalId: "principal-1",
        principalKind: "human",
        roleKeys: ["graph:member"],
        capabilityGrantIds: ["grant-1"],
        access: {
          authority: false,
          graphMember: true,
          sharedRead: false,
        },
        capabilityVersion: 3,
        policyVersion: 5,
      },
    });
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.session)).toBe(true);
    expect(Object.isFrozen(payload.principal)).toBe(true);
    expect(Object.isFrozen(payload.principal?.access)).toBe(true);
    expect(Object.isFrozen(payload.principal?.roleKeys)).toBe(true);
    expect(Object.isFrozen(payload.principal?.capabilityGrantIds)).toBe(true);
  });

  it("defines anonymous and reauth-relevant session states without inventing a principal", () => {
    expect(
      defineWebPrincipalBootstrapPayload({
        session: {
          authState: "signed-out",
          sessionId: null,
          principalId: null,
          capabilityVersion: null,
        },
        principal: null,
      }),
    ).toEqual({
      session: {
        authState: "signed-out",
        sessionId: null,
        principalId: null,
        capabilityVersion: null,
      },
      principal: null,
    });

    expect(
      defineWebPrincipalBootstrapPayload({
        session: {
          authState: "expired",
          sessionId: "session-1",
          principalId: null,
          capabilityVersion: null,
        },
        principal: null,
      }),
    ).toEqual({
      session: {
        authState: "expired",
        sessionId: "session-1",
        principalId: null,
        capabilityVersion: null,
      },
      principal: null,
    });
  });

  it("rejects malformed session and summary combinations", () => {
    expect(() =>
      defineWebPrincipalSession({
        authState: "signed-out",
        sessionId: "session-1",
        principalId: null,
        capabilityVersion: null,
      }),
    ).toThrow('sessionId must be null when authState is "signed-out".');

    expect(() =>
      defineWebPrincipalSummary({
        graphId: "graph:global",
        principalId: "principal-1",
        principalKind: "anonymous",
        roleKeys: [],
        capabilityGrantIds: [],
        access: {
          authority: false,
          graphMember: false,
          sharedRead: false,
        },
        capabilityVersion: 0,
        policyVersion: 0,
      }),
    ).toThrow('principalKind must not be "anonymous" in a web principal summary.');

    expect(() =>
      defineWebPrincipalSummary({
        graphId: "graph:global",
        principalId: "principal-1",
        principalKind: "human",
        roleKeys: [],
        capabilityGrantIds: [],
        access: {
          authority: false,
          graphMember: false,
          // @ts-expect-error runtime validation coverage
          sharedRead: "nope",
        },
        capabilityVersion: 0,
        policyVersion: 0,
      }),
    ).toThrow("access.sharedRead must be a boolean.");

    expect(() =>
      defineWebPrincipalBootstrapPayload({
        session: {
          authState: "ready",
          sessionId: "session-1",
          principalId: "principal-1",
          capabilityVersion: 2,
        },
        principal: {
          graphId: "graph:global",
          principalId: "principal-2",
          principalKind: "human",
          roleKeys: [],
          capabilityGrantIds: [],
          access: {
            authority: false,
            graphMember: false,
            sharedRead: false,
          },
          capabilityVersion: 2,
          policyVersion: 0,
        },
      }),
    ).toThrow("session.principalId must match principal.principalId.");
  });
});
