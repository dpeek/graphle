import {
  booleanTypeModule,
  core,
  defineReferenceField,
  defineType,
  numberTypeModule,
  stringTypeModule,
} from "@io/graph";

import { defineAppExperimentGraph } from "../contracts.js";
import { seedOutlinerExperiment } from "./seed.js";

export const block = defineType({
  values: { key: "app:block", name: "Outline Node" },
  fields: {
    ...core.node.fields,
    text: stringTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Text",
        editor: {
          kind: "textarea",
          multiline: true,
        },
      },
      filter: {
        operators: ["contains", "prefix"] as const,
        defaultOperator: "contains",
      },
    }),
    parent: defineReferenceField({
      range: "app:block",
      cardinality: "one?",
    }),
    order: numberTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Order",
      },
    }),
    collapsed: booleanTypeModule.field({
      cardinality: "one?",
      meta: {
        label: "Collapsed",
      },
      filter: {
        operators: ["is"] as const,
        defaultOperator: "is",
      },
    }),
  },
});

export const outlinerExperimentSchema = {
  block,
} as const;

export const outlinerExperimentGraph = defineAppExperimentGraph({
  key: "outliner",
  label: "Outliner",
  description: "Ordered block schema and keyboard-first outline proof surface.",
  schema: outlinerExperimentSchema,
  seed: seedOutlinerExperiment,
});
