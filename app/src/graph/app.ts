import { defineNamespace } from "@io/graph";

import { appGraphDefinitions } from "../experiments/graph.js";
export { company, person, status } from "../experiments/company/graph.js";
export { block } from "../experiments/outliner/graph.js";
export { envVar, secretRef } from "../experiments/env-vars/graph.js";
import ids from "./app.json";

export const app = defineNamespace(ids, appGraphDefinitions);
