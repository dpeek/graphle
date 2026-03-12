import { expect, test } from "bun:test";
import { resolve } from "node:path";

import { rewriteManagedBacklogDescription } from "./backlog-proposal.js";
import type { AgentIssue, ResolvedContextBundle, Workflow } from "./types.js";

function createIssue(description: string): AgentIssue {
  return {
    blockedBy: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    description,
    hasChildren: false,
    hasParent: false,
    id: "1",
    identifier: "OPE-127",
    labels: ["io", "agent"],
    priority: 2,
    projectSlug: "io",
    state: "Todo",
    title: "Managed backlog proposal",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

function createWorkflow(root: string): Pick<Workflow, "modules"> {
  return {
    modules: {
      agent: {
        allowedSharedPaths: [resolve(root, "io", "topic")],
        docs: ["./agent/io/goals.md"],
        id: "agent",
        path: resolve(root, "agent"),
      },
    },
  };
}

function createBundle(root: string): ResolvedContextBundle {
  return {
    docs: [
      {
        content: `# Project Overview

## What Has Landed

- typed repo config in \`io.ts\`
- built-in docs, profiles, and issue routing
- retained runtime state and stream-based worktree orchestration

## When changing this repo

- keep runtime behavior, repo docs, and tests in sync
- prefer the smallest change that still proves the contract end to end
`,
        id: "project.overview",
        label: "project.overview",
        order: 1,
        overridden: false,
        path: resolve(root, "io", "overview.md"),
        source: "registered",
      },
      {
        content: `# IO Agent Stream

## Current Focus

- improve operator utility
- improve planning and context quality

## Good Changes In This Stream

- quality of backlog/spec refinement
- automatic creation of better child-task structure
`,
        id: "./agent/io/goals.md",
        label: "./agent/io/goals.md",
        order: 2,
        overridden: false,
        path: resolve(root, "io", "goals.md"),
        source: "repo-path",
      },
    ],
  };
}

test("rewriteManagedBacklogDescription normalizes the parent description toward the shared template", () => {
  const root = "/repo";
  const description = `## Outcome

Turn a fresh parent issue into a durable planning brief.

## Deliverables

- define stable managed sections
- implement proposal generation in the backlog path
- preserve human-authored decisions on rerun

## Notes

- Keep it useful, not verbose.
`;

  const rewritten = rewriteManagedBacklogDescription({
    bundle: createBundle(root),
    issue: createIssue(description),
    repoRoot: root,
    workflow: createWorkflow(root),
  });

  expect(rewritten.startsWith("## Objective")).toBe(true);
  expect(rewritten).toContain("## Current Focus");
  expect(rewritten).toContain("## Constraints");
  expect(rewritten).toContain("## Proof Surfaces");
  expect(rewritten).toContain("./io/overview.md");
  expect(rewritten).toContain("Keep it useful, not verbose.");
  expect(rewritten).toContain("## Work Options");
  expect(rewritten).toContain("1. **Define stable managed sections**");
  expect(rewritten).toContain("2. **Implement proposal generation in the backlog");
  expect(rewritten).toContain("Alignment: Turn a fresh parent issue into a durable planning brief.");
  expect(rewritten).toContain("## Deferred");
});

test("rewriteManagedBacklogDescription removes legacy markers and preserves useful human sections", () => {
  const root = "/repo";
  const original = `## Outcome

Turn a fresh parent issue into a durable planning brief.

<!-- io-managed:backlog-proposal:start -->
## Managed Brief

### Current Module State
- old state

### Constraints
- old constraint

### Work Options
1. **Old option**
   Focus: old focus
   Alignment: old alignment
<!-- io-managed:backlog-proposal:end -->

## Decisions

- Keep the operator summary outside the managed block.
`;

  const rewritten = rewriteManagedBacklogDescription({
    bundle: createBundle(root),
    issue: createIssue(original),
    repoRoot: root,
    workflow: createWorkflow(root),
  });

  expect(rewritten).not.toContain("io-managed:backlog-proposal:start");
  expect(rewritten).not.toContain("old state");
  expect(rewritten).not.toContain("old option");
  expect(rewritten).toContain("## Decisions");
  expect(rewritten).toContain("Keep the operator summary outside the managed block.");
  expect(rewritten).toContain("Keep the operator summary outside the managed block.");
  expect(rewritten).toContain("## Work Options");
});
