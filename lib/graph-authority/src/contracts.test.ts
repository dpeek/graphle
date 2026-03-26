import { describe, expect, it } from "bun:test";

import {
  createShareGrantConstraints,
  defineAdmissionPolicy,
  defineShareGrant,
  defineShareSurface,
  validateShareGrant,
  validateShareSurface,
  type ShareGrantCapabilityProjection,
} from "./index.js";

describe("authority contracts", () => {
  it("freezes and validates admission policy domains and role keys", () => {
    const policy = defineAdmissionPolicy({
      graphId: "graph:global",
      bootstrapMode: "first-user",
      signupPolicy: "open",
      allowedEmailDomains: ["example.com"],
      firstUserProvisioning: {
        roleKeys: ["graph:owner", "graph:authority"],
      },
      signupProvisioning: {
        roleKeys: ["graph:member"],
      },
    });

    expect(policy.allowedEmailDomains).toEqual(["example.com"]);
    expect(() =>
      defineAdmissionPolicy({
        ...policy,
        allowedEmailDomains: ["Example.com"],
      }),
    ).toThrow("allowedEmailDomains must be lowercase.");
  });

  it("validates share surfaces against shareable predicate policy", () => {
    const surface = defineShareSurface({
      surfaceId: "share:topic-summary",
      kind: "entity-predicate-slice",
      rootEntityId: "topic:1",
      predicateIds: ["topic.name", "topic.summary"],
    });

    expect(
      validateShareSurface(surface, {
        "topic.name": {
          predicateId: "topic.name",
          shareable: true,
        },
        "topic.summary": {
          predicateId: "topic.summary",
          shareable: true,
        },
      }),
    ).toEqual({ ok: true });

    expect(
      validateShareSurface(surface, {
        "topic.name": {
          predicateId: "topic.name",
          shareable: true,
        },
        "topic.summary": {
          predicateId: "topic.summary",
          shareable: false,
        },
      }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "share.surface_invalid",
      }),
    });
  });

  it("keeps share grants aligned with their capability-grant projection", () => {
    const shareGrant = defineShareGrant({
      id: "share-grant:1",
      surface: {
        surfaceId: "share:topic-summary",
        kind: "entity-predicate-slice",
        rootEntityId: "topic:1",
        predicateIds: ["topic.name", "topic.summary"],
      },
      capabilityGrantId: "grant:1",
      status: "active",
    });

    const capabilityGrant = {
      id: "grant:1",
      resource: {
        kind: "share-surface",
        surfaceId: shareGrant.surface.surfaceId,
      },
      constraints: createShareGrantConstraints(shareGrant.surface),
      status: "active",
    } satisfies ShareGrantCapabilityProjection;

    expect(validateShareGrant(shareGrant, capabilityGrant)).toEqual({ ok: true });

    expect(
      validateShareGrant(shareGrant, {
        ...capabilityGrant,
        constraints: {
          ...capabilityGrant.constraints,
          predicateIds: ["topic.name"],
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
