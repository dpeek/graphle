import type { NamespaceClient } from "@io/graph";

import { companyExperimentGraph } from "./company/graph.js";
import {
  collectExperimentSchema,
  seedRegisteredExperiments,
  type RegisteredExperimentSeedResult,
} from "./contracts.js";
import { envVarsExperimentGraph } from "./env-vars/graph.js";
import { outlinerExperimentGraph } from "./outliner/graph.js";
import { workspaceExperimentGraph } from "./workspace/graph.js";

export const appExperimentGraphs = [
  companyExperimentGraph,
  workspaceExperimentGraph,
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
