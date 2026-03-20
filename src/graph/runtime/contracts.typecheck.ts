import type {
  GraphCommandSpec as GraphCommandSpecFromRoot,
  ObjectViewSpec as ObjectViewSpecFromRoot,
  WorkflowSpec as WorkflowSpecFromRoot,
} from "../index.js";
import type { GraphCommandSpec, ObjectViewSpec, WorkflowSpec } from "./index.js";

const topicSummaryView = {
  key: "pkm:topic:summary",
  entity: "pkm:topic",
  titleField: "name",
  subtitleField: "kind",
  sections: [
    {
      key: "summary",
      title: "Summary",
      fields: [
        { path: "name", label: "Name", span: 2 },
        { path: "kind", label: "Kind" },
      ],
    },
  ],
  related: [
    {
      key: "references",
      title: "References",
      relationPath: "references",
      presentation: "list",
    },
  ],
  commands: ["pkm:topic:save"],
} satisfies ObjectViewSpec;

const topicReviewWorkflow = {
  key: "pkm:topic:review",
  label: "Review topic",
  description: "Review and update a topic.",
  subjects: ["pkm:topic"],
  steps: [
    {
      key: "review",
      title: "Review details",
      objectView: topicSummaryView.key,
    },
    {
      key: "save",
      title: "Save changes",
      command: "pkm:topic:save",
    },
  ],
  commands: ["pkm:topic:save"],
} satisfies WorkflowSpec;

const saveTopicCommand = {
  key: "pkm:topic:save",
  label: "Save topic",
  subject: "pkm:topic",
  execution: "optimisticVerify",
  input: {
    title: "Document graph explorer affordances",
  },
  output: {
    topicId: "topic-1",
  },
  policy: {
    capabilities: ["topic.write"],
    touchesPredicates: ["pkm:topic.name", "pkm:topic.content"],
  },
} satisfies GraphCommandSpec<{ title: string }, { topicId: string }>;

const rootObjectView: ObjectViewSpecFromRoot = topicSummaryView;
const rootWorkflow: WorkflowSpecFromRoot = topicReviewWorkflow;
const rootCommand: GraphCommandSpecFromRoot<{ title: string }, { topicId: string }> =
  saveTopicCommand;

void rootObjectView;
void rootWorkflow;
void rootCommand;

void ({
  key: "pkm:topic:summary",
  entity: "pkm:topic",
  sections: [
    {
      key: "summary",
      title: "Summary",
      fields: [
        {
          path: "name",
          // @ts-expect-error object view field spans are limited to one or two columns
          span: 3,
        },
      ],
    },
  ],
} satisfies ObjectViewSpec);

void ({
  key: "pkm:topic:review",
  label: "Review topic",
  description: "Review and update a topic.",
  subjects: ["pkm:topic"],
  steps: [
    {
      key: "review",
      title: "Review details",
      // @ts-expect-error workflow steps refer to object view keys, not numeric ids
      objectView: 123,
    },
  ],
} satisfies WorkflowSpec);

void ({
  key: "pkm:topic:save",
  label: "Save topic",
  // @ts-expect-error commands must use one of the supported execution modes
  execution: "eventual",
  input: {
    title: "Document graph explorer affordances",
  },
  output: {
    topicId: "topic-1",
  },
} satisfies GraphCommandSpec);
