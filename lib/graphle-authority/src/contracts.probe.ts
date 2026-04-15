import type { PredicatePolicyDescriptor } from "../../graphle-kernel/src/index.js";

import type { AuthorizationContext, GraphCommandPolicy } from "./index.js";

export const probeAuthorizationContext = {
  graphId: "graph:probe",
  principalId: "principal:probe",
  principalKind: "human",
  sessionId: "session:probe",
  roleKeys: ["graph:member"],
  capabilityGrantIds: ["grant:probe:1"],
  capabilityVersion: 2,
  policyVersion: 7,
} satisfies AuthorizationContext;

export const probeContractNamePolicy = {
  predicateId: "probe:contractItem.name",
  transportVisibility: "replicated",
  requiredWriteScope: "server-command",
  readAudience: "graph-member",
  writeAudience: "module-command",
  shareable: true,
  requiredCapabilities: ["probe.contract.write"],
} satisfies PredicatePolicyDescriptor;

export const probeContractSummaryPolicy = {
  predicateId: "probe:contractItem.summary",
  transportVisibility: "replicated",
  requiredWriteScope: "server-command",
  readAudience: "graph-member",
  writeAudience: "module-command",
  shareable: true,
  requiredCapabilities: ["probe.contract.write"],
} satisfies PredicatePolicyDescriptor;

export const probeSaveContractItemCommand = {
  key: "probe:contractItem:save",
  policy: {
    capabilities: ["probe.contract.write"],
    touchesPredicates: [
      { predicateId: probeContractNamePolicy.predicateId },
      { predicateId: probeContractSummaryPolicy.predicateId },
    ],
  },
} satisfies {
  readonly key: string;
  readonly policy: GraphCommandPolicy;
};
