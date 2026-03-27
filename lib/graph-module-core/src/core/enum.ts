import { defineType } from "@io/graph-module";
import { defineReferenceField } from "@io/graph-module";

import { graphIconSeeds } from "../icon/seed.js";
import { node } from "./node.js";
import { coreType } from "./type.js";

export const enumType = defineType({
  values: { key: "core:enum", name: "Enum", icon: graphIconSeeds.enum },
  fields: {
    ...node.fields,
    member: defineReferenceField({
      range: coreType.values.key,
      cardinality: "many",
    }),
  },
});
