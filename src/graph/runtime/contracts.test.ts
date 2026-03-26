import { describe, expect, it } from "bun:test";

import {
  createShareGrantConstraints,
  defineAdmissionPolicy,
  defineWebPrincipalBootstrapPayload,
  defineWebPrincipalSession,
  defineWebPrincipalSummary,
  defineShareGrant,
  defineShareSurface,
  type ShareGrantCapabilityProjection,
  type ShareSurfacePolicy,
  validateShareGrant,
  validateShareSurface,
} from "./contracts.js";

describe("admission policy runtime contracts", () => {
  it("defines the minimal graph-owned admission policy for bootstrap and self-signup", () => {
    const policy = defineAdmissionPolicy({
      graphId: "graph:global",
      bootstrapMode: "first-user",
      signupPolicy: "open",
      allowedEmailDomains: ["example.com", "io.test"],
      firstUserProvisioning: {
        roleKeys: ["graph:owner", "graph:authority"],
      },
      signupProvisioning: {
        roleKeys: ["graph:member"],
      },
    });

    expect(policy).toEqual({
      graphId: "graph:global",
      bootstrapMode: "first-user",
      signupPolicy: "open",
      allowedEmailDomains: ["example.com", "io.test"],
      firstUserProvisioning: {
        roleKeys: ["graph:owner", "graph:authority"],
      },
      signupProvisioning: {
        roleKeys: ["graph:member"],
      },
    });
    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.allowedEmailDomains)).toBe(true);
    expect(Object.isFrozen(policy.firstUserProvisioning)).toBe(true);
    expect(Object.isFrozen(policy.firstUserProvisioning.roleKeys)).toBe(true);
    expect(Object.isFrozen(policy.signupProvisioning)).toBe(true);
    expect(Object.isFrozen(policy.signupProvisioning.roleKeys)).toBe(true);
  });

  it("rejects malformed admission policy combinations", () => {
    expect(() =>
      defineAdmissionPolicy({
        graphId: "graph:global",
        bootstrapMode: "first-user",
        signupPolicy: "closed",
        allowedEmailDomains: ["Example.com"],
        firstUserProvisioning: {
          roleKeys: ["graph:owner"],
        },
        signupProvisioning: {
          roleKeys: [],
        },
      }),
    ).toThrow("allowedEmailDomains must be lowercase.");

    expect(() =>
      defineAdmissionPolicy({
        graphId: "graph:global",
        bootstrapMode: "first-user",
        signupPolicy: "closed",
        allowedEmailDomains: [],
        firstUserProvisioning: {
          roleKeys: [],
        },
        signupProvisioning: {
          roleKeys: [],
        },
      }),
    ).toThrow(
      'firstUserProvisioning.roleKeys must not be empty when bootstrapMode is "first-user".',
    );

    expect(() =>
      defineAdmissionPolicy({
        graphId: "graph:global",
        bootstrapMode: "manual",
        signupPolicy: "open",
        allowedEmailDomains: [],
        firstUserProvisioning: {
          roleKeys: [],
        },
        signupProvisioning: {
          roleKeys: [],
        },
      }),
    ).toThrow('signupProvisioning.roleKeys must not be empty when signupPolicy is "open".');
  });
});

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

const topicNamePolicy = {
  predicateId: "pkm:topic.name",
  shareable: true,
} satisfies ShareSurfacePolicy;

const topicSummaryPolicy = {
  predicateId: "pkm:topic.summary",
  shareable: true,
} satisfies ShareSurfacePolicy;

const topicSecretPolicy = {
  predicateId: "pkm:topic.secretNotes",
  shareable: false,
} satisfies ShareSurfacePolicy;

describe("share surface runtime contracts", () => {
  it("defines the minimal entity-predicate share surface and aligned grant constraints", () => {
    const surface = defineShareSurface({
      surfaceId: "share:topic-1:summary",
      kind: "entity-predicate-slice",
      rootEntityId: "topic-1",
      predicateIds: [topicNamePolicy.predicateId, topicSummaryPolicy.predicateId],
    });

    expect(surface).toEqual({
      surfaceId: "share:topic-1:summary",
      kind: "entity-predicate-slice",
      rootEntityId: "topic-1",
      predicateIds: [topicNamePolicy.predicateId, topicSummaryPolicy.predicateId],
    });
    expect(Object.isFrozen(surface)).toBe(true);
    expect(Object.isFrozen(surface.predicateIds)).toBe(true);
    expect(createShareGrantConstraints(surface)).toEqual({
      rootEntityId: "topic-1",
      predicateIds: [topicNamePolicy.predicateId, topicSummaryPolicy.predicateId],
    });

    expect(() =>
      defineShareSurface({
        surfaceId: "share:topic-1:invalid",
        kind: "entity-predicate-slice",
        rootEntityId: "topic-1",
        predicateIds: [topicNamePolicy.predicateId, topicNamePolicy.predicateId],
      }),
    ).toThrow("predicateIds must not contain duplicate values.");
  });

  it("rejects predicates that are not explicitly shareable", () => {
    const result = validateShareSurface(
      {
        surfaceId: "share:topic-1:private",
        kind: "entity-predicate-slice",
        rootEntityId: "topic-1",
        predicateIds: [topicNamePolicy.predicateId, topicSecretPolicy.predicateId],
      },
      new Map<string, ShareSurfacePolicy>([
        [topicNamePolicy.predicateId, topicNamePolicy],
        [topicSecretPolicy.predicateId, topicSecretPolicy],
      ]),
    );

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "share.surface_invalid",
      }),
    });
  });

  it("requires linked capability grants to mirror the durable share surface selector", () => {
    const shareGrant = defineShareGrant({
      id: "share-grant-1",
      surface: {
        surfaceId: "share:topic-1:summary",
        kind: "entity-predicate-slice",
        rootEntityId: "topic-1",
        predicateIds: [topicNamePolicy.predicateId, topicSummaryPolicy.predicateId],
      },
      capabilityGrantId: "grant-share-1",
      status: "active",
    });

    const capabilityGrant: ShareGrantCapabilityProjection = {
      id: shareGrant.capabilityGrantId,
      resource: {
        kind: "share-surface",
        surfaceId: shareGrant.surface.surfaceId,
      },
      constraints: createShareGrantConstraints(shareGrant.surface),
      status: "active",
    };

    expect(validateShareGrant(shareGrant, capabilityGrant)).toEqual({ ok: true });

    expect(
      validateShareGrant(shareGrant, {
        ...capabilityGrant,
        constraints: {
          ...capabilityGrant.constraints,
          predicateIds: [topicNamePolicy.predicateId],
        },
      }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "grant.invalid",
      }),
    });
  });
});
