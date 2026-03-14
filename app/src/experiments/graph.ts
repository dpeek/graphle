import type { NamespaceClient } from "@io/graph";

import {
  collectExperimentSchema,
  seedRegisteredExperiments,
  type RegisteredExperimentSeedResult,
} from "./contracts.js";
import { companyExperimentGraph } from "./company/graph.js";
import { envVarsExperimentGraph } from "./env-vars/graph.js";
import { outlinerExperimentGraph } from "./outliner/graph.js";

export const appExperimentGraphs = [
  companyExperimentGraph,
  outlinerExperimentGraph,
  envVarsExperimentGraph,
] as const;

export const appGraphDefinitions = collectExperimentSchema(appExperimentGraphs);

export type RegisteredAppExperimentSeedResult = RegisteredExperimentSeedResult<
  typeof appExperimentGraphs
>;

export function seedRegisteredAppExperiments(
  graph: NamespaceClient<any>,
): RegisteredAppExperimentSeedResult {
  return seedRegisteredExperiments(appExperimentGraphs, graph);
}
