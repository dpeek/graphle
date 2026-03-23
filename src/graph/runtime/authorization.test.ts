import { describe, expect, it } from "bun:test";

import { authorizeCommand, authorizeRead, authorizeWrite } from "./authorization.js";
import {
  probeAuthorizationContext,
  probeContractNamePolicy,
  probeContractSummaryPolicy,
  probeSaveContractItemCommand,
} from "./contracts.probe.js";
import type { AuthorizationContext, AuthorizationPredicateTarget } from "./index.js";

const probeCapabilityKeys = ["probe.contract.write"] as const;

function createAuthorizationContext(
  overrides: Partial<AuthorizationContext> = {},
): AuthorizationContext {
  return {
    ...probeAuthorizationContext,
    ...overrides,
  };
}

function createTarget(
  overrides: Partial<AuthorizationPredicateTarget> = {},
): AuthorizationPredicateTarget {
  return {
    subjectId: "probe:item-1",
    ownerPrincipalId: probeAuthorizationContext.principalId,
    predicateId: probeContractSummaryPolicy.predicateId,
    policy: probeContractSummaryPolicy,
    ...overrides,
  };
}

describe("graph authorization evaluator", () => {
  it("fails closed when a predicate policy is missing", () => {
    const decision = authorizeRead({
      authorization: probeAuthorizationContext,
      capabilityKeys: probeCapabilityKeys,
      target: createTarget({
        policy: undefined,
      }),
    });

    expect(decision).toEqual({
      allowed: false,
      error: expect.objectContaining({
        code: "policy.read.forbidden",
      }),
    });
  });

  it("allows graph-member reads when the required capabilities are present", () => {
    const decision = authorizeRead({
      authorization: probeAuthorizationContext,
      capabilityKeys: probeCapabilityKeys,
      target: createTarget(),
    });

    expect(decision).toEqual({ allowed: true });
  });

  it("rejects unauthenticated reads for graph-member predicates", () => {
    const decision = authorizeRead({
      authorization: createAuthorizationContext({
        principalId: null,
        principalKind: null,
        sessionId: null,
        roleKeys: [],
        capabilityGrantIds: [],
        capabilityVersion: 0,
      }),
      capabilityKeys: probeCapabilityKeys,
      target: createTarget(),
    });

    expect(decision).toEqual({
      allowed: false,
      error: expect.objectContaining({
        code: "auth.unauthenticated",
      }),
    });
  });

  it("rejects direct writes to module-command predicates outside a command path", () => {
    const decision = authorizeWrite({
      authorization: probeAuthorizationContext,
      capabilityKeys: probeCapabilityKeys,
      target: createTarget(),
      writeScope: "server-command",
    });

    expect(decision).toEqual({
      allowed: false,
      error: expect.objectContaining({
        code: "policy.write.forbidden",
      }),
    });
  });

  it("rejects command writes that do not meet the predicate write scope", () => {
    const decision = authorizeWrite({
      authorization: probeAuthorizationContext,
      capabilityKeys: probeCapabilityKeys,
      target: createTarget(),
      writeScope: "client-tx",
      intent: "command",
    });

    expect(decision).toEqual({
      allowed: false,
      error: expect.objectContaining({
        code: "policy.write.forbidden",
      }),
    });
  });

  it("allows commands when policy, capabilities, and touched predicates align", () => {
    const decision = authorizeCommand({
      authorization: probeAuthorizationContext,
      capabilityKeys: probeCapabilityKeys,
      commandKey: probeSaveContractItemCommand.key,
      commandPolicy: probeSaveContractItemCommand.policy,
      touchedPredicates: [
        createTarget({
          predicateId: probeContractNamePolicy.predicateId,
          policy: probeContractNamePolicy,
        }),
        createTarget(),
      ],
    });

    expect(decision).toEqual({ allowed: true });
  });

  it("fails closed when a command does not evaluate every declared touched predicate", () => {
    const decision = authorizeCommand({
      authorization: probeAuthorizationContext,
      capabilityKeys: probeCapabilityKeys,
      commandKey: probeSaveContractItemCommand.key,
      commandPolicy: probeSaveContractItemCommand.policy,
      touchedPredicates: [createTarget()],
    });

    expect(decision).toEqual({
      allowed: false,
      error: expect.objectContaining({
        code: "policy.command.forbidden",
      }),
    });
  });
});
