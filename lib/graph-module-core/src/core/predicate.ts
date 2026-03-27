import { defineType } from "@io/graph-module";
import { defineReferenceField } from "@io/graph-module";

import { graphIconSeeds } from "../icon/seed.js";
import { cardinalityTypeModule } from "./cardinality.js";
import { iconReferenceField } from "./icon.js";
import { node } from "./node.js";
import { stringTypeModule } from "./string.js";
import { coreType } from "./type.js";

export const predicate = defineType({
  values: { key: "core:predicate", name: "Predicate", icon: graphIconSeeds.edge },
  fields: {
    ...node.fields,
    key: stringTypeModule.field({
      cardinality: "one",
      icon: stringTypeModule.type.values.icon,
      meta: {
        label: "Key",
      },
      filter: {
        operators: ["equals", "prefix"] as const,
        defaultOperator: "equals",
      },
    }),
    range: defineReferenceField({
      range: coreType.values.key,
      cardinality: "one?",
    }),
    cardinality: cardinalityTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Cardinality",
      },
      filter: {
        operators: ["is"] as const,
        defaultOperator: "is",
      },
    }),
    icon: iconReferenceField(),
  },
});
