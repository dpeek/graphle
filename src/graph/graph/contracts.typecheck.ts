import type {
  GraphCommandSpec as GraphCommandSpecFromRoot,
  ObjectViewSpec as ObjectViewSpecFromRoot,
  WorkflowSpec as WorkflowSpecFromRoot,
} from "../index.js";
import type {
  GraphCommandSpec,
  ObjectViewSpec,
  WorkflowSpec,
} from "./index.js";

const workspaceIssueSummaryView = {
  key: "app:workspaceIssue:summary",
  entity: "app:workspaceIssue",
  titleField: "name",
  subtitleField: "status",
  sections: [
    {
      key: "summary",
      title: "Summary",
      fields: [
        { path: "name", label: "Name", span: 2 },
        { path: "status", label: "Status" },
      ],
    },
  ],
  related: [
    {
      key: "children",
      title: "Child issues",
      relationPath: "children",
      presentation: "list",
    },
  ],
  commands: ["app:workspaceIssue:save"],
} satisfies ObjectViewSpec;

const workspaceIssueTriageWorkflow = {
  key: "app:workspaceIssue:triage",
  label: "Triage issue",
  description: "Review and update a workspace issue.",
  subjects: ["app:workspaceIssue"],
  steps: [
    {
      key: "review",
      title: "Review details",
      objectView: workspaceIssueSummaryView.key,
    },
    {
      key: "save",
      title: "Save changes",
      command: "app:workspaceIssue:save",
    },
  ],
  commands: ["app:workspaceIssue:save"],
} satisfies WorkflowSpec;

const saveWorkspaceIssueCommand = {
  key: "app:workspaceIssue:save",
  label: "Save issue",
  subject: "app:workspaceIssue",
  execution: "optimisticVerify",
  input: {
    title: "Tighten acceptance criteria",
  },
  output: {
    issueId: "issue-1",
  },
  policy: {
    capabilities: ["workspace.write"],
    touchesPredicates: ["app:workspaceIssue.name", "app:workspaceIssue.status"],
  },
} satisfies GraphCommandSpec<{ title: string }, { issueId: string }>;

const rootObjectView: ObjectViewSpecFromRoot = workspaceIssueSummaryView;
const rootWorkflow: WorkflowSpecFromRoot = workspaceIssueTriageWorkflow;
const rootCommand: GraphCommandSpecFromRoot<{ title: string }, { issueId: string }> =
  saveWorkspaceIssueCommand;

void rootObjectView;
void rootWorkflow;
void rootCommand;

void ({
  key: "app:workspaceIssue:summary",
  entity: "app:workspaceIssue",
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
  key: "app:workspaceIssue:triage",
  label: "Triage issue",
  description: "Review and update a workspace issue.",
  subjects: ["app:workspaceIssue"],
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
  key: "app:workspaceIssue:save",
  label: "Save issue",
  // @ts-expect-error commands must use one of the supported execution modes
  execution: "eventual",
  input: {
    title: "Tighten acceptance criteria",
  },
  output: {
    issueId: "issue-1",
  },
} satisfies GraphCommandSpec);
