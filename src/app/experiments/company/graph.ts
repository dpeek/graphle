import {
  addressFields,
  core,
  defineType,
  existingEntityReferenceField,
  emailTypeModule,
  numberTypeModule,
  slugTypeModule,
  stringTypeModule,
  urlTypeModule,
} from "@io/core/graph";

import { statusTypeModule } from "../../type/status/index.js";
import { defineAppExperimentGraph } from "../contracts.js";
import { seedCompanyExperiment } from "./seed.js";

export const status = statusTypeModule.type;

export const company = defineType({
  values: { key: "app:company", name: "Company" },
  fields: {
    ...core.node.fields,
    address: {
      ...addressFields,
    },
    status: statusTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Status",
        display: {
          kind: "badge",
        },
      },
      filter: {
        operators: ["is"] as const,
        defaultOperator: "is",
      },
    }),
    foundedYear: numberTypeModule.field({
      cardinality: "one?",
      meta: {
        label: "Founded year",
      },
      filter: {
        operators: ["equals", "gt", "lt"] as const,
        defaultOperator: "equals",
      },
    }),
    tags: stringTypeModule.field({
      cardinality: "many",
      meta: {
        label: "Tags",
        collection: {
          kind: "unordered",
        },
        editor: {
          kind: "token-list",
        },
      },
      filter: {
        operators: ["contains", "equals"] as const,
        defaultOperator: "contains",
      },
    }),
    website: urlTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Website",
        display: {
          kind: "external-link",
        },
      },
    }),
    contactEmail: emailTypeModule.field({
      cardinality: "one?",
      meta: {
        label: "Contact email",
      },
      filter: {
        operators: ["equals", "domain"] as const,
        defaultOperator: "domain",
      },
    }),
    slug: slugTypeModule.field({
      cardinality: "one?",
      meta: {
        label: "Slug",
      },
    }),
  },
});

export const person = defineType({
  values: { key: "app:person", name: "Person" },
  fields: {
    ...core.node.fields,
    worksAt: existingEntityReferenceField(company, {
      cardinality: "many",
      label: "Works at",
    }),
  },
});

export const companyExperimentSchema = {
  company,
  person,
  status,
} as const;

export const companyExperimentGraph = defineAppExperimentGraph({
  key: "companyModel",
  label: "Company model",
  description: "Core company schema plus query and relationship proof routes.",
  schema: companyExperimentSchema,
  seed: seedCompanyExperiment,
});
