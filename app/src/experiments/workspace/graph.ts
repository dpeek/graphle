import {
  core,
  dateTypeModule,
  defineDefaultEnumTypeModule,
  defineEnum,
  defineReferenceField,
  defineType,
  numberTypeModule,
  slugTypeModule,
  stringTypeModule,
  type Cardinality,
  type RangeRef,
} from "@io/graph";

import { defineAppExperimentGraph } from "../contracts.js";
import { seedWorkspaceExperiment } from "./seed.js";

const existingReferencePolicy = {
  selection: "existing-only",
  create: false,
} as const;

function workspaceReferenceField<const Range extends RangeRef, const Card extends Cardinality>(
  range: Range,
  input: {
    cardinality: Card;
    collection?: "ordered" | "unordered";
    label: string;
  },
) {
  const { cardinality, collection, label } = input;
  return defineReferenceField({
    range,
    cardinality,
    meta: {
      label,
      ...(collection ? { collection: { kind: collection } } : {}),
      reference: existingReferencePolicy,
    },
  });
}

const workflowStatusCategoryType = defineEnum({
  values: { key: "app:workflowStatusCategory", name: "Workflow Status Category" },
  options: {
    backlog: {
      name: "Backlog",
      description: "Still being shaped or waiting for release.",
    },
    unstarted: {
      name: "Unstarted",
      description: "Ready to pick up but not started yet.",
    },
    started: {
      name: "Started",
      description: "Actively being worked right now.",
    },
    completed: {
      name: "Completed",
      description: "Finished and accepted.",
    },
    canceled: {
      name: "Canceled",
      description: "Closed without delivery.",
    },
  },
});

const workflowStatusCategoryTypeModule = defineDefaultEnumTypeModule(workflowStatusCategoryType);

export const workspaceProject = defineType({
  values: { key: "app:workspaceProject", name: "Workspace Project" },
  fields: {
    ...core.node.fields,
    key: slugTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Key",
      },
      filter: {
        operators: ["equals", "prefix"] as const,
        defaultOperator: "equals",
      },
    }),
    color: stringTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Color",
      },
    }),
    targetDate: dateTypeModule.field({
      cardinality: "one?",
      meta: {
        label: "Target date",
      },
      filter: {
        operators: ["on", "before", "after"] as const,
        defaultOperator: "on",
      },
    }),
  },
});

export const workspaceLabel = defineType({
  values: { key: "app:workspaceLabel", name: "Workspace Label" },
  fields: {
    ...core.node.fields,
    key: slugTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Key",
      },
      filter: {
        operators: ["equals", "prefix"] as const,
        defaultOperator: "equals",
      },
    }),
    color: stringTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Color",
      },
    }),
  },
});

export const workflowStatus = defineType({
  values: { key: "app:workflowStatus", name: "Workflow Status" },
  fields: {
    ...core.node.fields,
    key: slugTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Key",
      },
      filter: {
        operators: ["equals", "prefix"] as const,
        defaultOperator: "equals",
      },
    }),
    category: workflowStatusCategoryTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Category",
        display: {
          kind: "badge",
        },
      },
      filter: {
        operators: ["is"] as const,
        defaultOperator: "is",
      },
    }),
    order: numberTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Order",
      },
      filter: {
        operators: ["equals", "lt", "gt"] as const,
        defaultOperator: "equals",
      },
    }),
    color: stringTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Color",
      },
    }),
  },
});

export const workspaceIssue = defineType({
  values: { key: "app:workspaceIssue", name: "Workspace Issue" },
  fields: {
    ...core.node.fields,
    identifier: stringTypeModule.field({
      cardinality: "one",
      validate: ({ value }) =>
        typeof value === "string" && value.trim().length > 0
          ? undefined
          : {
              code: "string.blank",
              message: "Identifier must not be blank.",
            },
      meta: {
        label: "Identifier",
      },
      filter: {
        operators: ["equals", "prefix"] as const,
        defaultOperator: "equals",
      },
    }),
    priority: numberTypeModule.field({
      cardinality: "one?",
      meta: {
        label: "Priority",
      },
      filter: {
        operators: ["equals", "lt", "gt"] as const,
        defaultOperator: "equals",
      },
    }),
    dueDate: dateTypeModule.field({
      cardinality: "one?",
      meta: {
        label: "Due date",
      },
      filter: {
        operators: ["on", "before", "after"] as const,
        defaultOperator: "on",
      },
    }),
    project: workspaceReferenceField(workspaceProject, {
      cardinality: "one?",
      label: "Project",
    }),
    status: workspaceReferenceField(workflowStatus, {
      cardinality: "one",
      label: "Status",
    }),
    labels: workspaceReferenceField(workspaceLabel, {
      cardinality: "many",
      collection: "unordered",
      label: "Labels",
    }),
    parent: workspaceReferenceField("app:workspaceIssue", {
      cardinality: "one?",
      label: "Parent issue",
    }),
    blockedBy: workspaceReferenceField("app:workspaceIssue", {
      cardinality: "many",
      collection: "unordered",
      label: "Blocked by",
    }),
  },
});

export const workspace = defineType({
  values: { key: "app:workspace", name: "Workspace" },
  fields: {
    ...core.node.fields,
    key: slugTypeModule.field({
      cardinality: "one",
      meta: {
        label: "Key",
      },
      filter: {
        operators: ["equals", "prefix"] as const,
        defaultOperator: "equals",
      },
    }),
    projects: workspaceReferenceField(workspaceProject, {
      cardinality: "many",
      collection: "ordered",
      label: "Projects",
    }),
    labels: workspaceReferenceField(workspaceLabel, {
      cardinality: "many",
      collection: "unordered",
      label: "Labels",
    }),
    statuses: workspaceReferenceField(workflowStatus, {
      cardinality: "many",
      collection: "ordered",
      label: "Workflow statuses",
    }),
    issues: workspaceReferenceField(workspaceIssue, {
      cardinality: "many",
      collection: "ordered",
      label: "Issues",
    }),
  },
});

export const workflowStatusCategory = workflowStatusCategoryTypeModule.type;

export const workspaceExperimentSchema = {
  workflowStatus,
  workflowStatusCategory,
  workspace,
  workspaceIssue,
  workspaceLabel,
  workspaceProject,
} as const;

export const workspaceExperimentGraph = defineAppExperimentGraph({
  key: "workspaceModel",
  label: "Workspace model",
  description: "Linear-like workspace schema and planning seed data for management proofs.",
  schema: workspaceExperimentSchema,
  seed: seedWorkspaceExperiment,
});
