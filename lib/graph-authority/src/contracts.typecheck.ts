import type { PredicatePolicyDescriptor } from "@io/graph-kernel";

import type {
  AdmissionPolicy,
  AuthorizationContext,
  CapabilityGrant,
  GraphCommandPolicy,
  PrincipalRoleBinding,
  ShareGrant,
  ShareSurface,
} from "./index.js";

const authorizationContext = {
  graphId: "graph:1",
  principalId: "principal:1",
  principalKind: "human",
  sessionId: "session:1",
  roleKeys: ["graph:member"],
  capabilityGrantIds: ["grant:1"],
  capabilityVersion: 1,
  policyVersion: 2,
} satisfies AuthorizationContext;

const admissionPolicy = {
  graphId: "graph:1",
  bootstrapMode: "manual",
  signupPolicy: "closed",
  allowedEmailDomains: [],
  firstUserProvisioning: {
    roleKeys: ["graph:owner"],
  },
  signupProvisioning: {
    roleKeys: [],
  },
} satisfies AdmissionPolicy;

const predicatePolicy = {
  predicateId: "topic.summary",
  transportVisibility: "replicated",
  requiredWriteScope: "server-command",
  readAudience: "graph-member",
  writeAudience: "module-command",
  shareable: true,
  requiredCapabilities: ["topic.write"],
} satisfies PredicatePolicyDescriptor;

const commandPolicy = {
  capabilities: ["topic.write"],
  touchesPredicates: [{ predicateId: predicatePolicy.predicateId }],
} satisfies GraphCommandPolicy;

const capabilityGrant = {
  id: "grant:1",
  resource: {
    kind: "share-surface",
    surfaceId: "share:topic",
  },
  target: {
    kind: "principal",
    principalId: "principal:1",
  },
  grantedByPrincipalId: "principal:operator",
  status: "active",
  issuedAt: "2026-03-26T00:00:00.000Z",
} satisfies CapabilityGrant;

const roleBinding = {
  id: "binding:1",
  principalId: "principal:1",
  roleKey: "graph:member",
  status: "active",
} satisfies PrincipalRoleBinding;

const shareSurface = {
  surfaceId: "share:topic",
  kind: "entity-predicate-slice",
  rootEntityId: "topic:1",
  predicateIds: [predicatePolicy.predicateId],
} satisfies ShareSurface;

const shareGrant = {
  id: "share-grant:1",
  surface: shareSurface,
  capabilityGrantId: capabilityGrant.id,
  status: "active",
} satisfies ShareGrant;

void authorizationContext;
void admissionPolicy;
void commandPolicy;
void capabilityGrant;
void roleBinding;
void shareSurface;
void shareGrant;
