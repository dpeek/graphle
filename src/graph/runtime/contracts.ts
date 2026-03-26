import type {
  CapabilityGrant,
  CapabilityGrantResource,
  CapabilityVersion,
  GraphCommandPolicy,
  GraphCommandTouchedPredicate,
  PolicyVersion,
  PrincipalKind,
  PrincipalRoleBinding,
} from "@io/graph-authority";
import type { PolicyCapabilityKey, PredicatePolicyDescriptor } from "@io/graph-kernel";

/**
 * Stable provider-neutral auth subject tuple mirrored by
 * `core:authSubjectProjection`. Host-specific request/session parsing remains
 * provisional.
 */
export type AuthSubjectRef = {
  readonly issuer: string;
  readonly provider: string;
  readonly providerAccountId: string;
  readonly authUserId: string;
};

/**
 * Stable minimal authenticated session shape consumed by request-time
 * projection seams. Better Auth-specific session payload details stay in host
 * code.
 */
export type AuthenticatedSession = {
  readonly sessionId: string;
  readonly subject: AuthSubjectRef;
  readonly email?: string;
};

/**
 * Stable browser-visible shell session states. `booting` is client-local while
 * the shell is still resolving whether it can fetch a principal summary.
 */
export type WebPrincipalSessionState = "booting" | "signed-out" | "ready" | "expired";

/**
 * Stable minimal browser-visible session contract shared by app shells and
 * tools.
 */
export type WebPrincipalSession = {
  readonly authState: WebPrincipalSessionState;
  readonly sessionId: string | null;
  readonly principalId: string | null;
  readonly capabilityVersion: CapabilityVersion | null;
  readonly displayName?: string;
};

/**
 * Stable graph-backed principal summary derived from request-bound authority
 * state for browser/bootstrap consumers.
 */
export type WebPrincipalSummary = {
  readonly graphId: string;
  readonly principalId: string;
  readonly principalKind: PrincipalKind;
  readonly roleKeys: readonly string[];
  readonly capabilityGrantIds: readonly string[];
  readonly access: {
    readonly authority: boolean;
    readonly graphMember: boolean;
    readonly sharedRead: boolean;
  };
  readonly capabilityVersion: CapabilityVersion;
  readonly policyVersion: PolicyVersion;
};

/**
 * Stable minimal bootstrap payload for anonymous and authenticated callers.
 */
export type WebPrincipalBootstrapPayload = {
  readonly session: WebPrincipalSession;
  readonly principal: WebPrincipalSummary | null;
};

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

export function defineWebPrincipalSession<const T extends WebPrincipalSession>(
  session: T,
): Readonly<T> {
  if (session.sessionId !== null) {
    assertNonEmptyContractString(session.sessionId, "sessionId");
  }

  if (session.principalId !== null) {
    assertNonEmptyContractString(session.principalId, "principalId");
  }

  if (session.displayName != null) {
    assertNonEmptyContractString(session.displayName, "displayName");
  }

  if (session.capabilityVersion !== null && session.capabilityVersion < 0) {
    throw new TypeError("capabilityVersion must not be negative.");
  }

  switch (session.authState) {
    case "booting":
    case "signed-out":
      if (session.sessionId !== null) {
        throw new TypeError(`sessionId must be null when authState is "${session.authState}".`);
      }
      if (session.principalId !== null) {
        throw new TypeError(`principalId must be null when authState is "${session.authState}".`);
      }
      if (session.capabilityVersion !== null) {
        throw new TypeError(
          `capabilityVersion must be null when authState is "${session.authState}".`,
        );
      }
      break;
    case "ready":
      if (session.sessionId === null) {
        throw new TypeError('sessionId must be present when authState is "ready".');
      }
      if ((session.principalId === null) !== (session.capabilityVersion === null)) {
        throw new TypeError(
          'principalId and capabilityVersion must either both be present or both be null when authState is "ready".',
        );
      }
      break;
    case "expired":
      if (session.principalId !== null) {
        throw new TypeError('principalId must be null when authState is "expired".');
      }
      if (session.capabilityVersion !== null) {
        throw new TypeError('capabilityVersion must be null when authState is "expired".');
      }
      break;
    default: {
      const exhaustive: never = session.authState;
      return exhaustive;
    }
  }

  return Object.freeze({
    ...session,
  }) as Readonly<T>;
}

export function defineWebPrincipalSummary<const T extends WebPrincipalSummary>(
  summary: T,
): Readonly<T> {
  assertNonEmptyContractString(summary.graphId, "graphId");
  assertNonEmptyContractString(summary.principalId, "principalId");
  assertUniqueContractStrings(summary.roleKeys, "roleKeys");
  assertUniqueContractStrings(summary.capabilityGrantIds, "capabilityGrantIds");

  if (summary.principalKind === "anonymous") {
    throw new TypeError('principalKind must not be "anonymous" in a web principal summary.');
  }

  if (summary.capabilityVersion < 0) {
    throw new TypeError("capabilityVersion must not be negative.");
  }

  if (summary.policyVersion < 0) {
    throw new TypeError("policyVersion must not be negative.");
  }
  if (typeof summary.access.authority !== "boolean") {
    throw new TypeError("access.authority must be a boolean.");
  }
  if (typeof summary.access.graphMember !== "boolean") {
    throw new TypeError("access.graphMember must be a boolean.");
  }
  if (typeof summary.access.sharedRead !== "boolean") {
    throw new TypeError("access.sharedRead must be a boolean.");
  }

  return Object.freeze({
    ...summary,
    access: Object.freeze({
      authority: summary.access.authority,
      graphMember: summary.access.graphMember,
      sharedRead: summary.access.sharedRead,
    }),
    roleKeys: freezeStringValues(summary.roleKeys),
    capabilityGrantIds: freezeStringValues(summary.capabilityGrantIds),
  }) as Readonly<T>;
}

export function defineWebPrincipalBootstrapPayload<const T extends WebPrincipalBootstrapPayload>(
  payload: T,
): Readonly<T> {
  const session = defineWebPrincipalSession(payload.session);
  const principal = payload.principal ? defineWebPrincipalSummary(payload.principal) : null;

  if (session.authState !== "ready" && principal !== null) {
    throw new TypeError('principal must be null unless session.authState is "ready".');
  }

  if (principal) {
    if (session.principalId === null) {
      throw new TypeError("session.principalId must be present when principal is provided.");
    }
    if (session.principalId !== principal.principalId) {
      throw new TypeError("session.principalId must match principal.principalId.");
    }
    if (session.capabilityVersion === null) {
      throw new TypeError("session.capabilityVersion must be present when principal is provided.");
    }
    if (session.capabilityVersion !== principal.capabilityVersion) {
      throw new TypeError("session.capabilityVersion must match principal.capabilityVersion.");
    }
  }

  return Object.freeze({
    ...payload,
    session,
    principal,
  }) as Readonly<T>;
}

/**
 * Stable manifest-facing permission identifier. Module approval, grant,
 * revocation, and install-plan surfaces all key off this value.
 */
export type ModulePermissionKey = string;

type ModulePermissionRequestBase = {
  readonly key: ModulePermissionKey;
  readonly reason: string;
  readonly required: boolean;
};

/**
 * Canonical install-time module permission request surface shared across
 * manifest loading, planning, and module-install flows.
 */
export type ModulePermissionRequest =
  | (ModulePermissionRequestBase & {
      readonly kind: "predicate-read";
      readonly predicateIds: readonly string[];
    })
  | (ModulePermissionRequestBase & {
      readonly kind: "predicate-write";
      readonly predicateIds: readonly string[];
      readonly writeScope: PredicatePolicyDescriptor["requiredWriteScope"];
    })
  | (ModulePermissionRequestBase & {
      readonly kind: "command-execute";
      readonly commandKeys: readonly string[];
      readonly touchesPredicates?: readonly GraphCommandTouchedPredicate["predicateId"][];
    })
  | (ModulePermissionRequestBase & {
      readonly kind: "secret-use";
      readonly capabilityKeys: readonly PolicyCapabilityKey[];
    })
  | (ModulePermissionRequestBase & {
      readonly kind: "share-admin";
      readonly surfaceIds?: readonly string[];
    })
  | (ModulePermissionRequestBase & {
      readonly kind: "external-service";
      readonly serviceKeys: readonly string[];
    })
  | (ModulePermissionRequestBase & {
      readonly kind: "background-job";
      readonly jobKeys: readonly string[];
    })
  | (ModulePermissionRequestBase & {
      readonly kind: "blob-class";
      readonly blobClassKeys: readonly string[];
    });

export type ModulePermissionGrantResource = Extract<
  CapabilityGrantResource,
  {
    readonly kind: "module-permission";
  }
>;

export type ModulePermissionCapabilityGrant = CapabilityGrant & {
  readonly resource: ModulePermissionGrantResource;
};

export type ModulePermissionLowering =
  | {
      readonly kind: "capability-grant";
      readonly grant: ModulePermissionCapabilityGrant;
    }
  | {
      readonly kind: "role-binding";
      readonly binding: PrincipalRoleBinding;
    };

export type ModulePermissionApprovalStatus = "approved" | "denied" | "revoked";

type ModulePermissionApprovalRecordBase = {
  readonly moduleId: string;
  readonly permissionKey: ModulePermissionKey;
  readonly request: ModulePermissionRequest;
  readonly decidedAt: string;
  readonly decidedByPrincipalId: string;
  readonly note?: string;
};

type ModulePermissionApprovalLowerings = readonly [
  ModulePermissionLowering,
  ...ModulePermissionLowering[],
];

/**
 * Durable authority decision record for one declared module permission.
 */
export type ModulePermissionApprovalRecord =
  | (ModulePermissionApprovalRecordBase & {
      readonly status: "approved";
      readonly lowerings: ModulePermissionApprovalLowerings;
      readonly revokedAt?: never;
      readonly revokedByPrincipalId?: never;
      readonly revocationNote?: never;
    })
  | (ModulePermissionApprovalRecordBase & {
      readonly status: "denied";
      readonly lowerings: readonly [];
      readonly revokedAt?: never;
      readonly revokedByPrincipalId?: never;
      readonly revocationNote?: never;
    })
  | (ModulePermissionApprovalRecordBase & {
      readonly status: "revoked";
      readonly lowerings: ModulePermissionApprovalLowerings;
      readonly revokedAt: string;
      readonly revokedByPrincipalId: string;
      readonly revocationNote?: string;
    });

export type ObjectViewFieldSpec = {
  readonly path: string;
  readonly label?: string;
  readonly description?: string;
  readonly span?: 1 | 2;
};

export type ObjectViewSectionSpec = {
  readonly key: string;
  readonly title: string;
  readonly description?: string;
  readonly fields: readonly ObjectViewFieldSpec[];
};

export type ObjectViewRelatedSpec = {
  readonly key: string;
  readonly title: string;
  readonly relationPath: string;
  readonly presentation: "list" | "table" | "board";
};

export type ObjectViewSpec = {
  readonly key: string;
  readonly entity: string;
  readonly titleField?: string;
  readonly subtitleField?: string;
  readonly sections: readonly ObjectViewSectionSpec[];
  readonly related?: readonly ObjectViewRelatedSpec[];
  readonly commands?: readonly string[];
};

export type WorkflowStepSpec = {
  readonly key: string;
  readonly title: string;
  readonly description?: string;
  readonly objectView?: string;
  readonly command?: string;
};

export type WorkflowSpec = {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly subjects: readonly string[];
  readonly steps: readonly WorkflowStepSpec[];
  readonly commands?: readonly string[];
};

export type GraphCommandExecution = "localOnly" | "optimisticVerify" | "serverOnly";

export type GraphCommandSpec<Input = unknown, Output = unknown> = {
  readonly key: string;
  readonly label: string;
  readonly subject?: string;
  readonly execution: GraphCommandExecution;
  readonly input: Input;
  readonly output: Output;
  readonly policy?: GraphCommandPolicy;
};
