import type { NamespaceClient } from "@io/graph";

import type { outlinerExperimentSchema } from "./graph.js";

type OutlinerExperimentClient = NamespaceClient<typeof outlinerExperimentSchema>;

export type OutlinerExperimentIds = {
  readonly rootBlock: string;
};

export function seedOutlinerExperiment(graph: OutlinerExperimentClient): OutlinerExperimentIds {
  const rootBlock = graph.block.create({
    name: "Untitled",
    text: "Untitled",
    order: 0,
  });

  return {
    rootBlock,
  };
}
