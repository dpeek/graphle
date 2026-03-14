import { describe, expect, it } from "bun:test";

import { bootstrap, core, createStore, createTypeClient } from "@io/graph";

import { app } from "../../graph/app.js";
import { seedRegisteredAppExperiments } from "../graph.js";

describe("workspace experiment seed", () => {
  it("creates a coherent planning workspace with projects, statuses, labels, and linked issues", () => {
    const store = createStore();
    bootstrap(store, core);
    bootstrap(store, app);
    const graph = createTypeClient(store, app);

    const seeded = seedRegisteredAppExperiments(graph);

    expect(graph.workspace.get(seeded.ioWorkspace)).toMatchObject({
      key: "io-planning",
      projects: [seeded.workspaceProofProject, seeded.graphRuntimeProject],
      labels: [seeded.appLabel, seeded.graphLabel, seeded.planningLabel, seeded.infraLabel],
      statuses: [
        seeded.backlogStatus,
        seeded.todoStatus,
        seeded.inProgressStatus,
        seeded.doneStatus,
      ],
    });

    expect(graph.workflowStatus.get(seeded.doneStatus).category).toBe(
      app.workflowStatusCategory.values.completed.id,
    );

    expect(graph.workspaceIssue.get(seeded.workspaceManagement)).toMatchObject({
      identifier: "OPE-197",
      project: seeded.workspaceProofProject,
      status: seeded.inProgressStatus,
      labels: [seeded.appLabel, seeded.planningLabel],
    });

    expect(graph.workspaceIssue.get(seeded.workspaceSchema)).toMatchObject({
      identifier: "OPE-208",
      parent: seeded.workspaceManagement,
      project: seeded.workspaceProofProject,
      status: seeded.todoStatus,
    });

    expect(graph.workspaceIssue.get(seeded.workspaceRoute)).toMatchObject({
      identifier: "OPE-209",
      parent: seeded.workspaceManagement,
      blockedBy: [seeded.workspaceSchema],
      status: seeded.backlogStatus,
    });

    expect(graph.workspaceIssue.get(seeded.feedbackTriage)).toMatchObject({
      identifier: "OPE-212",
      blockedBy: [seeded.workspaceRoute],
      project: undefined,
    });
  });
});
