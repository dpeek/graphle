import { defineNamespace } from "@io/core/graph";

import { appGraphDefinitions } from "../experiments/graph.js";
export { company, person, status } from "../experiments/company/graph.js";
export { envVar, secretRef } from "@io/core/graph/schema/app/env-vars";
export { block } from "@io/core/graph/schema/app/outliner";
export {
  workflowStatus,
  workflowStatusCategory,
  workspace,
  workspaceIssue,
  workspaceLabel,
  workspaceProject,
} from "@io/core/graph/schema/app/workspace";
import ids from "./app.json";

export const app = defineNamespace(ids, appGraphDefinitions);
