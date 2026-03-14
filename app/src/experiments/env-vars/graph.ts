import {
  core,
  dateTypeModule,
  defineReferenceField,
  defineType,
  numberTypeModule,
  stringTypeModule,
} from "@io/graph";

import {
  envVarNameBlankMessage,
  envVarNameInvalidMessage,
  envVarNamePattern,
} from "../../env-vars.js";
import { defineAppExperimentGraph } from "../contracts.js";

export const secretRef = defineType({
  values: { key: "app:secretRef", name: "Secret Reference" },
  fields: {
    ...core.node.fields,
    version: numberTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Secret version",
      },
    }),
    lastRotatedAt: dateTypeModule.field({
      cardinality: "one?",
      meta: {
        label: "Last rotated",
      },
    }),
  },
});

export const envVar = defineType({
  values: { key: "app:envVar", name: "Environment Variable" },
  fields: {
    ...core.node.fields,
    name: stringTypeModule.field({
      cardinality: "one",
      validate: ({ value }) => {
        if (typeof value !== "string" || value.trim().length === 0) {
          return {
            code: "string.blank",
            message: envVarNameBlankMessage,
          };
        }
        if (!envVarNamePattern.test(value)) {
          return {
            code: "envVar.name.invalid",
            message: envVarNameInvalidMessage,
          };
        }
        return undefined;
      },
      meta: {
        label: "Variable name",
      },
    }),
    secret: defineReferenceField({
      range: secretRef,
      cardinality: "one?",
      meta: {
        label: "Secret reference",
      },
    }),
  },
});

export const envVarsExperimentSchema = {
  envVar,
  secretRef,
} as const;

export const envVarsExperimentGraph = defineAppExperimentGraph({
  key: "envVars",
  label: "Environment variables",
  description: "Authority-backed env-var metadata and secret reference modeling.",
  schema: envVarsExperimentSchema,
});
