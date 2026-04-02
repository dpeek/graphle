import { describe, expect, it } from "bun:test";

import {
  createWorkflowReviewStartupContract,
  resolveCanonicalWorkflowRouteSearch,
  resolveWorkflowReviewStartupState,
  validateWorkflowRouteSearch,
} from "./workflow-review-contract.js";

describe("workflow review startup contract", () => {
  it("defaults the browser workflow route to the workflow-review sync scope", () => {
    const contract = createWorkflowReviewStartupContract();

    expect(contract.graph.requestedScope).toEqual({
      kind: "module",
      moduleId: "workflow",
      scopeId: "scope:workflow:review",
    });
    expect(contract.initialSelection.project).toEqual({
      kind: "infer-singleton",
    });
    expect(contract.reads.mainWorkflow).toEqual({
      kind: "main-commit-workflow-scope",
      query: {
        commitId: ":selected-workflow-commit",
        projectId: ":resolved-project-id",
      },
    });
  });

  it("normalizes workflow route search params", () => {
    expect(
      validateWorkflowRouteSearch({
        commit: " commit:selected ",
        project: " project:io ",
        session: " session:latest ",
      }),
    ).toEqual({
      commit: "commit:selected",
      project: "project:io",
      session: "session:latest",
    });

    expect(
      validateWorkflowRouteSearch({
        project: "   ",
      }),
    ).toEqual({});
  });

  it("requires explicit project selection when the review scope exposes multiple projects", () => {
    const contract = createWorkflowReviewStartupContract();

    expect(
      resolveWorkflowReviewStartupState(
        [
          { id: "project:io", title: "IO" },
          { id: "project:docs", title: "Docs" },
        ],
        contract,
      ),
    ).toMatchObject({
      kind: "missing-data",
      reason: "project-selection-required",
    });
  });

  it("resolves the singleton project without requiring a branch inventory step", () => {
    const contract = createWorkflowReviewStartupContract();
    const state = resolveWorkflowReviewStartupState([{ id: "project:io", title: "IO" }], contract);

    expect(state).toEqual({
      contract,
      kind: "ready",
      project: {
        id: "project:io",
        title: "IO",
      },
    });
  });

  it("surfaces configured project drift as missing data", () => {
    const contract = createWorkflowReviewStartupContract({
      project: "project:missing",
    });

    expect(
      resolveWorkflowReviewStartupState([{ id: "project:io", title: "IO" }], contract),
    ).toMatchObject({
      kind: "missing-data",
      reason: "configured-project-missing",
    });
  });

  it("canonicalizes inferred route selection once the resolved project is known", () => {
    const contract = createWorkflowReviewStartupContract();
    const startupState = resolveWorkflowReviewStartupState(
      [{ id: "project:io", title: "IO" }],
      contract,
    );

    expect(
      resolveCanonicalWorkflowRouteSearch(
        {
          commit: "commit:selected",
          session: "session:latest",
        },
        startupState,
      ),
    ).toEqual({
      commit: "commit:selected",
      project: "project:io",
      session: "session:latest",
    });
  });

  it("canonicalizes the inferred selected commit when the route has no explicit commit yet", () => {
    const contract = createWorkflowReviewStartupContract();
    const startupState = resolveWorkflowReviewStartupState(
      [{ id: "project:io", title: "IO" }],
      contract,
    );

    expect(resolveCanonicalWorkflowRouteSearch({}, startupState, "commit:queue-head")).toEqual({
      commit: "commit:queue-head",
      project: "project:io",
    });

    expect(
      resolveCanonicalWorkflowRouteSearch(
        {
          session: "session:branch",
        },
        startupState,
        "commit:queue-head",
      ),
    ).toEqual({
      project: "project:io",
      session: "session:branch",
    });
  });
});
