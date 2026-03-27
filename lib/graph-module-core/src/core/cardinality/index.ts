import { defineEnum } from "@io/graph-module";
import { defineDefaultEnumTypeModule } from "@io/graph-module";

export const cardinality = defineEnum({
  values: { key: "core:cardinality", name: "Cardinality" },
  options: {
    one: {
      name: "Exactly one",
      description: "Predicate must have exactly one value",
    },
    oneOptional: {
      name: "Zero or one",
      description: "Predicate may have zero or one value",
    },
    many: {
      name: "Many",
      description: "Predicate may have multiple values",
    },
  },
});

export const cardinalityTypeModule = defineDefaultEnumTypeModule(cardinality);
