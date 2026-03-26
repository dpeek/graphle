import type { PolicyCapabilityKey, PredicatePolicyDescriptor } from "@io/graph-kernel";

/**
 * Stable graph-owned principal kinds.
 */
export type PrincipalKind = "human" | "service" | "agent" | "anonymous" | "remoteGraph";

/**
 * Monotonic principal-scoped capability snapshot version.
 */
export type CapabilityVersion = number;

/**
 * Monotonic graph-scoped authorization policy snapshot version.
 */
export type PolicyVersion = number;

/**
 * Stable request-bound authorization snapshot consumed by authority read,
 * write, command, and replication filtering paths.
 */
export type AuthorizationContext = {
  readonly graphId: string;
  readonly principalId: string | null;
  readonly principalKind: PrincipalKind | null;
  readonly sessionId: string | null;
  readonly roleKeys: readonly string[];
  readonly capabilityGrantIds: readonly string[];
  readonly capabilityVersion: CapabilityVersion;
  readonly policyVersion: PolicyVersion;
};

/**
 * Stable delegated-capability vocabulary shared by graph schema and authority
 * runtime consumers.
 */
export type CapabilityGrantResource =
  | {
      readonly kind: "predicate-read";
      readonly predicateId: string;
    }
  | {
      readonly kind: "predicate-write";
      readonly predicateId: string;
    }
  | {
      readonly kind: "command-execute";
      readonly commandKey: string;
    }
  | {
      readonly kind: "module-permission";
      readonly permissionKey: string;
    }
  | {
      readonly kind: "share-surface";
      readonly surfaceId: string;
    };

export type CapabilityGrantTarget =
  | {
      readonly kind: "principal";
      readonly principalId: string;
    }
  | {
      readonly kind: "graph";
      readonly graphId: string;
    }
  | {
      readonly kind: "bearer";
      readonly tokenHash: string;
    };

export type CapabilityGrantConstraints = {
  readonly rootEntityId?: string;
  readonly predicateIds?: readonly string[];
  readonly expiresAt?: string;
  readonly delegatedFromGrantId?: string;
};

export type CapabilityGrantStatus = "active" | "expired" | "revoked";

export type CapabilityGrant = {
  readonly id: string;
  readonly resource: CapabilityGrantResource;
  readonly target: CapabilityGrantTarget;
  readonly grantedByPrincipalId: string;
  readonly constraints?: CapabilityGrantConstraints;
  readonly status: CapabilityGrantStatus;
  readonly issuedAt: string;
  readonly revokedAt?: string;
};

export const shareSurfaceKinds = ["entity-predicate-slice"] as const;

/**
 * Explicit policy-contract epoch for share-surface validation and lowering.
 */
export const shareSurfaceContractVersion = 0;

export type ShareSurfaceKind = (typeof shareSurfaceKinds)[number];

/**
 * First-cut durable share surface for one rooted entity plus one predicate set.
 */
export type ShareSurface = {
  readonly surfaceId: string;
  readonly kind: "entity-predicate-slice";
  readonly rootEntityId: string;
  readonly predicateIds: readonly string[];
};

export type ShareGrantStatus = CapabilityGrantStatus;

export type ShareGrant = {
  readonly id: string;
  readonly surface: ShareSurface;
  readonly capabilityGrantId: string;
  readonly status: ShareGrantStatus;
};

export type ShareSurfacePolicy = Pick<PredicatePolicyDescriptor, "predicateId" | "shareable">;

export type ShareSurfacePolicyLookup =
  | ReadonlyMap<string, ShareSurfacePolicy | null | undefined>
  | Readonly<Record<string, ShareSurfacePolicy | null | undefined>>;

export type ShareGrantCapabilityProjection = Pick<
  CapabilityGrant,
  "id" | "resource" | "constraints" | "status"
>;

export type AdmissionBootstrapMode = "manual" | "first-user";

export type AdmissionSignupPolicy = "closed" | "open";

export type AdmissionProvisioning = {
  readonly roleKeys: readonly string[];
};

/**
 * Graph-owned admission policy enforced by the authority boundary.
 */
export type AdmissionPolicy = {
  readonly graphId: string;
  readonly bootstrapMode: AdmissionBootstrapMode;
  readonly signupPolicy: AdmissionSignupPolicy;
  readonly allowedEmailDomains: readonly string[];
  readonly firstUserProvisioning: AdmissionProvisioning;
  readonly signupProvisioning: AdmissionProvisioning;
};

export type PrincipalRoleBindingStatus = "active" | "revoked";

export type PrincipalRoleBinding = {
  readonly id: string;
  readonly principalId: string;
  readonly roleKey: string;
  readonly status: PrincipalRoleBindingStatus;
};

export type PolicyErrorCode =
  | "auth.unauthenticated"
  | "auth.principal_missing"
  | "policy.read.forbidden"
  | "policy.write.forbidden"
  | "policy.command.forbidden"
  | "policy.stale_context"
  | "grant.invalid"
  | "share.surface_invalid";

export type PolicyError = {
  readonly code: PolicyErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly refreshRequired?: boolean;
};

export type ShareValidationResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly error: PolicyError;
    };

export type AuthorizationDecision =
  | {
      readonly allowed: true;
    }
  | {
      readonly allowed: false;
      readonly error: PolicyError;
    };

function shareValidationFailure(
  code: Extract<PolicyErrorCode, "grant.invalid" | "share.surface_invalid">,
  message: string,
): ShareValidationResult {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable: false,
    },
  };
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertNonEmptyContractString(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new TypeError(`${label} must not be empty.`);
  }
}

function assertUniqueContractStrings(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    assertNonEmptyContractString(value, label);
    if (seen.has(value)) {
      throw new TypeError(`${label} must not contain duplicate values.`);
    }
    seen.add(value);
  }
}

function freezeStringValues(values: readonly string[]): readonly string[] {
  return Object.freeze([...values]);
}

function assertDomainName(value: string, label: string): void {
  assertNonEmptyContractString(value, label);
  if (value !== value.toLowerCase()) {
    throw new TypeError(`${label} must be lowercase.`);
  }
  if (value.includes("@")) {
    throw new TypeError(`${label} must contain only the domain, not an email address.`);
  }
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(value)) {
    throw new TypeError(`${label} must be a valid domain name.`);
  }
}

function isShareSurfacePolicyMap(
  policies: ShareSurfacePolicyLookup,
): policies is ReadonlyMap<string, ShareSurfacePolicy | null | undefined> {
  return policies instanceof Map;
}

function getShareSurfacePolicy(
  policies: ShareSurfacePolicyLookup,
  predicateId: string,
): ShareSurfacePolicy | null | undefined {
  return isShareSurfacePolicyMap(policies) ? policies.get(predicateId) : policies[predicateId];
}

function matchesStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightValues = new Set(right);
  return left.every((value) => rightValues.has(value));
}

export function defineAdmissionPolicy<const T extends AdmissionPolicy>(policy: T): Readonly<T> {
  assertNonEmptyContractString(policy.graphId, "graphId");
  assertUniqueContractStrings(
    policy.firstUserProvisioning.roleKeys,
    "firstUserProvisioning.roleKeys",
  );
  assertUniqueContractStrings(policy.signupProvisioning.roleKeys, "signupProvisioning.roleKeys");

  const allowedEmailDomains = [...policy.allowedEmailDomains];
  assertUniqueContractStrings(allowedEmailDomains, "allowedEmailDomains");
  for (const domain of allowedEmailDomains) {
    assertDomainName(domain, "allowedEmailDomains");
  }

  if (policy.bootstrapMode === "first-user" && policy.firstUserProvisioning.roleKeys.length === 0) {
    throw new TypeError(
      'firstUserProvisioning.roleKeys must not be empty when bootstrapMode is "first-user".',
    );
  }

  if (policy.signupPolicy === "open" && policy.signupProvisioning.roleKeys.length === 0) {
    throw new TypeError(
      'signupProvisioning.roleKeys must not be empty when signupPolicy is "open".',
    );
  }

  return Object.freeze({
    ...policy,
    allowedEmailDomains: freezeStringValues(allowedEmailDomains),
    firstUserProvisioning: Object.freeze({
      ...policy.firstUserProvisioning,
      roleKeys: freezeStringValues(policy.firstUserProvisioning.roleKeys),
    }),
    signupProvisioning: Object.freeze({
      ...policy.signupProvisioning,
      roleKeys: freezeStringValues(policy.signupProvisioning.roleKeys),
    }),
  }) as Readonly<T>;
}

export function defineShareSurface<const T extends ShareSurface>(surface: T): Readonly<T> {
  assertNonEmptyContractString(surface.surfaceId, "surfaceId");
  assertNonEmptyContractString(surface.rootEntityId, "rootEntityId");

  switch (surface.kind) {
    case "entity-predicate-slice":
      if (surface.predicateIds.length === 0) {
        throw new TypeError("predicateIds must not be empty.");
      }
      assertUniqueContractStrings(surface.predicateIds, "predicateIds");
      break;
    default: {
      const exhaustive: never = surface.kind;
      return exhaustive;
    }
  }

  return Object.freeze({
    ...surface,
    predicateIds: freezeStringValues(surface.predicateIds),
  }) as Readonly<T>;
}

export function createShareGrantConstraints(
  surface: ShareSurface,
): Required<Pick<CapabilityGrantConstraints, "rootEntityId" | "predicateIds">> {
  const definedSurface = defineShareSurface(surface);
  return Object.freeze({
    rootEntityId: definedSurface.rootEntityId,
    predicateIds: freezeStringValues(definedSurface.predicateIds),
  });
}

export function defineShareGrant<const T extends ShareGrant>(shareGrant: T): Readonly<T> {
  assertNonEmptyContractString(shareGrant.id, "id");
  assertNonEmptyContractString(shareGrant.capabilityGrantId, "capabilityGrantId");

  return Object.freeze({
    ...shareGrant,
    surface: defineShareSurface(shareGrant.surface),
  }) as Readonly<T>;
}

export function validateShareSurface(
  surface: ShareSurface,
  predicatePolicies: ShareSurfacePolicyLookup,
): ShareValidationResult {
  let definedSurface: Readonly<ShareSurface>;
  try {
    definedSurface = defineShareSurface(surface);
  } catch (error) {
    return shareValidationFailure("share.surface_invalid", asErrorMessage(error));
  }

  for (const predicateId of definedSurface.predicateIds) {
    const policy = getShareSurfacePolicy(predicatePolicies, predicateId);
    if (!policy) {
      return shareValidationFailure(
        "share.surface_invalid",
        `Share surface "${definedSurface.surfaceId}" cannot include predicate "${predicateId}" because no predicate policy was provided.`,
      );
    }
    if (policy.predicateId !== predicateId) {
      return shareValidationFailure(
        "share.surface_invalid",
        `Share surface "${definedSurface.surfaceId}" cannot include predicate "${predicateId}" because the provided policy targeted "${policy.predicateId}".`,
      );
    }
    if (!policy.shareable) {
      return shareValidationFailure(
        "share.surface_invalid",
        `Share surface "${definedSurface.surfaceId}" cannot include predicate "${predicateId}" because it is not shareable.`,
      );
    }
  }

  return { ok: true };
}

export function validateShareGrant(
  shareGrant: ShareGrant,
  capabilityGrant: ShareGrantCapabilityProjection,
): ShareValidationResult {
  let definedSurface: Readonly<ShareSurface>;
  try {
    definedSurface = defineShareSurface(shareGrant.surface);
  } catch (error) {
    return shareValidationFailure("share.surface_invalid", asErrorMessage(error));
  }

  try {
    assertNonEmptyContractString(shareGrant.id, "id");
    assertNonEmptyContractString(shareGrant.capabilityGrantId, "capabilityGrantId");
  } catch (error) {
    return shareValidationFailure("grant.invalid", asErrorMessage(error));
  }

  const definedShareGrant = Object.freeze({
    ...shareGrant,
    surface: definedSurface,
  }) as Readonly<ShareGrant>;

  if (capabilityGrant.id !== definedShareGrant.capabilityGrantId) {
    return shareValidationFailure(
      "grant.invalid",
      `Share grant "${definedShareGrant.id}" must reference capability grant "${capabilityGrant.id}".`,
    );
  }

  if (capabilityGrant.resource.kind !== "share-surface") {
    return shareValidationFailure(
      "grant.invalid",
      `Capability grant "${capabilityGrant.id}" must target a share-surface resource.`,
    );
  }

  if (capabilityGrant.resource.surfaceId !== definedShareGrant.surface.surfaceId) {
    return shareValidationFailure(
      "grant.invalid",
      `Capability grant "${capabilityGrant.id}" must target share surface "${definedShareGrant.surface.surfaceId}".`,
    );
  }

  if (capabilityGrant.status !== definedShareGrant.status) {
    return shareValidationFailure(
      "grant.invalid",
      `Share grant "${definedShareGrant.id}" must match capability grant "${capabilityGrant.id}" status "${capabilityGrant.status}".`,
    );
  }

  const constraints = capabilityGrant.constraints;
  if (!constraints?.rootEntityId) {
    return shareValidationFailure(
      "grant.invalid",
      `Capability grant "${capabilityGrant.id}" must constrain the shared root entity.`,
    );
  }
  if (constraints.rootEntityId !== definedShareGrant.surface.rootEntityId) {
    return shareValidationFailure(
      "grant.invalid",
      `Capability grant "${capabilityGrant.id}" must constrain root entity "${definedShareGrant.surface.rootEntityId}".`,
    );
  }
  if (!constraints.predicateIds || constraints.predicateIds.length === 0) {
    return shareValidationFailure(
      "grant.invalid",
      `Capability grant "${capabilityGrant.id}" must constrain the shared predicate set.`,
    );
  }

  try {
    assertUniqueContractStrings(
      constraints.predicateIds,
      "capabilityGrant.constraints.predicateIds",
    );
  } catch (error) {
    return shareValidationFailure("grant.invalid", asErrorMessage(error));
  }

  if (!matchesStringSet(constraints.predicateIds, definedShareGrant.surface.predicateIds)) {
    return shareValidationFailure(
      "grant.invalid",
      `Capability grant "${capabilityGrant.id}" must constrain the same predicate set as share grant "${definedShareGrant.id}".`,
    );
  }

  return { ok: true };
}

export type AuthorizationSubject = {
  readonly subjectId: string;
  readonly ownerPrincipalId?: string | null;
};

export type AuthorizationPredicateTarget = AuthorizationSubject & {
  readonly predicateId: string;
  readonly policy?: PredicatePolicyDescriptor | null;
};

export type AuthorizeReadInput = {
  readonly authorization: AuthorizationContext;
  readonly target: AuthorizationPredicateTarget;
  readonly capabilityKeys?: readonly PolicyCapabilityKey[];
  readonly sharedRead?: boolean;
};

export type AuthorizeWriteIntent = "transaction" | "command";

export type AuthorizeWriteInput = AuthorizeReadInput & {
  readonly writeScope: PredicatePolicyDescriptor["requiredWriteScope"];
  readonly intent?: AuthorizeWriteIntent;
};

export type AuthorizationCommandTouchedPredicate = AuthorizationPredicateTarget;

export type GraphCommandTouchedPredicate = Pick<PredicatePolicyDescriptor, "predicateId">;

export type GraphCommandPolicy = {
  readonly capabilities?: readonly PolicyCapabilityKey[];
  readonly touchesPredicates?: readonly GraphCommandTouchedPredicate[];
};

export type AuthorizeCommandInput = {
  readonly authorization: AuthorizationContext;
  readonly commandKey: string;
  readonly commandPolicy?: GraphCommandPolicy | null;
  readonly touchedPredicates?: readonly AuthorizationCommandTouchedPredicate[];
  readonly capabilityKeys?: readonly PolicyCapabilityKey[];
  readonly writeScope?: PredicatePolicyDescriptor["requiredWriteScope"];
};
