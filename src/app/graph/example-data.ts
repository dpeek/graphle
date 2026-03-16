import type { NamespaceClient } from "@io/core/graph";

import {
  seedRegisteredAppExperiments,
  type RegisteredAppExperimentSeedResult,
} from "../experiments/graph.js";
import { app } from "./app.js";

export type ExampleGraphIds = RegisteredAppExperimentSeedResult;

export function seedExampleGraph(graph: NamespaceClient<typeof app>): ExampleGraphIds {
  return seedRegisteredAppExperiments(graph);
}
