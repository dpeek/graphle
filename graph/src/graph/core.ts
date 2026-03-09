import coreIdMap from "./core.json";
import { defineEnum, defineNamespace, defineScalar, defineType, rangeOf } from "./schema.js";
import { booleanTypeModule } from "../type/boolean.js";
import { numberTypeModule } from "../type/number.js";
import { stringTypeModule } from "../type/string.js";
import { urlTypeModule } from "../type/url.js";

const string = stringTypeModule.type;

const number = numberTypeModule.type;

const date = defineScalar({
  values: { key: "core:date", name: "Date" },
  encode: (value: Date) => value.toISOString(),
  decode: (string) => new Date(string),
});

const boolean = booleanTypeModule.type;

const url = urlTypeModule.type;

const node = defineType({
  values: { key: "core:node", name: "Node" },
  fields: {
    type: { range: "core:type", cardinality: "many" },
    name: stringTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Name",
      },
    }),
    label: stringTypeModule.field({
      cardinality: "one?",
      meta: {
        label: "Label",
      },
    }),
    description: stringTypeModule.field({
      cardinality: "one?",
      meta: {
        label: "Description",
        editor: {
          kind: "textarea",
          multiline: true,
        },
      },
      filter: {
        operators: ["contains", "equals"] as const,
        defaultOperator: "contains",
      },
    }),
    createdAt: {
      range: date.values.key,
      cardinality: "one?",
      onCreate: ({ incoming, now }) => incoming ?? now,
    },
    updatedAt: {
      range: date.values.key,
      cardinality: "one?",
      onCreate: ({ now }) => now,
      onUpdate: ({ now, changedPredicateKeys }) =>
        [...changedPredicateKeys].some(
          (key) => !key.endsWith(":createdAt") && !key.endsWith(":updatedAt"),
        )
          ? now
          : undefined,
    },
  },
});

const type = defineType({
  values: { key: "core:type", name: "Type" },
  fields: {
    ...node.fields,
  },
});

const cardinality = defineEnum({
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

const predicate = defineType({
  values: { key: "core:predicate", name: "Predicate" },
  fields: {
    ...node.fields,
    key: stringTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Key",
      },
      filter: {
        operators: ["equals", "prefix"] as const,
        defaultOperator: "equals",
      },
    }),
    range: { range: type.values.key, cardinality: "one?" },
    cardinality: { range: rangeOf(cardinality), cardinality: "one" },
  },
});

const _enum = defineType({
  values: { key: "core:enum", name: "Enum" },
  fields: {
    ...node.fields,
    member: { range: type.values.key, cardinality: "many" },
  },
});

export const core = defineNamespace(coreIdMap, {
  string,
  number,
  date,
  boolean,
  url,
  type,
  cardinality,
  predicate,
  enum: _enum,
  node,
});
