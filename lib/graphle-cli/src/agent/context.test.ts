import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_BACKLOG_BUILTIN_DOC_IDS,
  DEFAULT_EXECUTE_BUILTIN_DOC_IDS,
  DEFAULT_REVIEW_BUILTIN_DOC_IDS,
} from "./builtins.js";
import { renderContextBundle, resolveIssueContext } from "./context.js";
import { resolveIssueRouting } from "./issue-routing.js";
import type { AgentIssue, PreparedWorkspace, Workflow } from "./types.js";
import { loadWorkflowFile, renderPrompt } from "./workflow.js";

function createWorkflow(root: string, promptPath: string): Workflow {
  return {
    agent: {
      maxConcurrentAgents: 1,
      maxRetryBackoffMs: 1_000,
      maxTurns: 1,
    },
    codex: {
      approvalPolicy: "never",
      command: "codex app-server",
      readTimeoutMs: 5_000,
      stallTimeoutMs: 60_000,
      threadSandbox: "workspace-write",
      turnTimeoutMs: 60_000,
    },
    context: {
      docs: {
        "project.architecture": resolve(root, "graphle", "context", "architecture.md"),
        "project.backlog": resolve(root, "graphle", "context", "backlog.md"),
        "project.overview": resolve(root, "graphle", "context", "overview.md"),
      },
      overrides: {},
      profiles: {
        backlog: {
          include: [...DEFAULT_BACKLOG_BUILTIN_DOC_IDS, "project.backlog"],
          includeEntrypoint: true,
        },
        execute: {
          include: [...DEFAULT_EXECUTE_BUILTIN_DOC_IDS],
          includeEntrypoint: true,
        },
        review: {
          include: [...DEFAULT_REVIEW_BUILTIN_DOC_IDS],
          includeEntrypoint: true,
        },
      },
    },
    entrypoint: {
      configPath: resolve(root, "graphle.ts"),
      kind: "graphle",
      promptPath,
    },
    hooks: {
      timeoutMs: 60_000,
    },
    issues: {
      defaultAgent: "execute",
      defaultProfile: "execute",
      routing: [],
    },
    modules: {},
    polling: {
      intervalMs: 30_000,
    },
    entrypointContent: "LOCAL {{ selection.agent }} {{ selection.profile }}",
    tracker: {
      activeStates: ["Todo"],
      endpoint: "https://api.linear.app/graphql",
      kind: "linear",
      terminalStates: ["Done"],
    },
    tui: {
      graph: {
        kind: "http",
      },
      initialScope: {},
    },
    workspace: {
      root,
    },
  };
}

function createIssue(description: string): AgentIssue {
  return {
    blockedBy: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    description,
    hasChildren: false,
    hasParent: false,
    id: "1",
    identifier: "OPE-61",
    labels: [],
    priority: 3,
    projectSlug: "graphle",
    state: "Todo",
    title: "Issue context",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

function createWorkspace(root: string): PreparedWorkspace {
  return {
    branchName: "graphle/ope-61",
    controlPath: root,
    createdNow: true,
    originPath: root,
    path: resolve(root, "workspace"),
    workerId: "OPE-61",
  };
}

test("resolveIssueContext uses linked issue doc references after repo defaults and profile docs", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "context-"));
  const promptPath = resolve(root, "graphle.md");
  await mkdir(resolve(root, "graphle", "context"), { recursive: true });
  await writeFile(promptPath, "LOCAL {{ selection.agent }} {{ selection.profile }}\n");
  await writeFile(resolve(root, "graphle", "context", "architecture.md"), "ARCHITECTURE DOC\n");
  await writeFile(resolve(root, "graphle", "context", "overview.md"), "OVERVIEW DOC\n");
  await writeFile(resolve(root, "graphle", "context", "linked.md"), "LINKED DOC\n");

  try {
    const issue = createIssue(`## Summary

Important refs:

- \`project.architecture\`
- \`project.overview\`
- \`./graphle/context/linked.md\`
- \`./graphle/context/missing.md\`
- \`builtin:graphle.core.validation\`
`);
    const workflow = createWorkflow(root, promptPath);
    const resolved = await resolveIssueContext({
      baseSelection: { agent: "execute", profile: "execute" },
      issue,
      repoRoot: root,
      workflow,
    });
    const rendered = renderPrompt(renderContextBundle(resolved.bundle), {
      attempt: 1,
      issue: resolved.issue,
      selection: resolved.selection,
      worker: { count: 1, id: issue.identifier, index: 0 },
      workspace: createWorkspace(root),
    });

    expect(resolved.selection).toEqual({ agent: "execute", profile: "execute" });
    expect(resolved.bundle.docs.map((doc) => doc.id)).toEqual([
      "builtin:graphle.agent.execute.default",
      "builtin:graphle.context.discovery",
      "builtin:graphle.linear.status-updates",
      "builtin:graphle.core.validation",
      "builtin:graphle.core.git-safety",
      "context.entrypoint",
      "project.architecture",
      "project.overview",
      "./graphle/context/linked.md",
      "issue.context",
    ]);
    expect(resolved.warnings).toEqual([
      "Unresolved issue doc reference: ./graphle/context/missing.md",
    ]);
    expect(rendered).toContain("You are the Graphle Execution Agent.");
    expect(rendered).not.toContain("You are the Graphle Backlog Agent.");
    expect(rendered).toContain("LOCAL execute execute");
    expect(rendered).toContain("ARCHITECTURE DOC");
    expect(rendered).toContain("OVERVIEW DOC");
    expect(rendered).toContain("LINKED DOC");
    expect(rendered).toContain("run the repo's required validation before declaring the work done");
    expect(rendered).toContain("Issue Description:");
    expect(rendered).toContain("Important refs:");

    expect(rendered.indexOf("You are the Graphle Execution Agent.")).toBeLessThan(
      rendered.indexOf("LOCAL execute execute"),
    );
    expect(rendered.indexOf("LOCAL execute execute")).toBeLessThan(
      rendered.indexOf("ARCHITECTURE DOC"),
    );
    expect(rendered.indexOf("LINKED DOC")).toBeLessThan(rendered.indexOf("Issue Description:"));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("resolveIssueContext supports doc-id overrides and profile entrypoint opt-out", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "context-"));
  await mkdir(resolve(root, "graphle", "context"), { recursive: true });
  await writeFile(resolve(root, "graphle.md"), "LOCAL {{ issue.identifier }}\n");
  await writeFile(resolve(root, "graphle", "context", "architecture.md"), "ARCHITECTURE DOC\n");
  await writeFile(
    resolve(root, "graphle", "context", "architecture-override.md"),
    "OVERRIDDEN DOC\n",
  );

  try {
    const workflow = createWorkflow(root, resolve(root, "graphle.md"));
    workflow.context.overrides["project.architecture"] = resolve(
      root,
      "graphle",
      "context",
      "architecture-override.md",
    );
    workflow.context.profiles.execute = {
      include: ["project.architecture"],
      includeEntrypoint: false,
    };

    const resolved = await resolveIssueContext({
      baseSelection: { agent: "execute", profile: "execute" },
      issue: createIssue("Implement override behavior"),
      repoRoot: root,
      workflow,
    });

    expect(
      resolved.bundle.docs.map((doc) => ({
        id: doc.id,
        overridden: doc.overridden,
        path: doc.path,
        source: doc.source,
      })),
    ).toEqual([
      {
        id: "project.architecture",
        overridden: true,
        path: resolve(root, "graphle", "context", "architecture-override.md"),
        source: "registered",
      },
      {
        id: "issue.context",
        overridden: false,
        path: undefined,
        source: "synthesized",
      },
    ]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("repo config allows shared repo docs in stream issue descriptions without warning", async () => {
  const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));
  process.env.LINEAR_API_KEY = "linear-token";
  process.env.LINEAR_PROJECT_SLUG = "graphle";

  const workflowResult = await loadWorkflowFile(undefined, repoRoot);
  expect(workflowResult.ok).toBe(true);
  if (!workflowResult.ok) {
    return;
  }

  const issue: AgentIssue = {
    blockedBy: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    description: "Keep the stream description aligned with `./lib/cli/src/agent/index.ts`.",
    hasChildren: true,
    hasParent: false,
    id: "1",
    identifier: "OPE-134",
    labels: ["graphle", "agent"],
    priority: 3,
    projectSlug: "graphle",
    state: "Todo",
    title: "Branch shared-doc refresh",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const resolved = await resolveIssueContext({
    baseSelection: resolveIssueRouting(
      workflowResult.value.issues,
      issue,
      workflowResult.value.modules,
    ),
    issue,
    repoRoot,
    workflow: workflowResult.value,
  });

  expect(resolved.warnings).not.toContain(
    "Issue doc reference is outside module scope: ./lib/cli/src/agent/index.ts",
  );
});

test("resolveIssueContext adds module docs and limits repo-path refs to module scope", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "context-"));
  const promptPath = resolve(root, "graphle.md");
  await mkdir(resolve(root, "agent", "doc"), { recursive: true });
  await mkdir(resolve(root, "graph", "doc"), { recursive: true });
  await mkdir(resolve(root, "graphle"), { recursive: true });
  await writeFile(promptPath, "LOCAL {{ selection.agent }} {{ selection.profile }}\n");
  await writeFile(resolve(root, "agent", "doc", "module-default.md"), "MODULE DEFAULT DOC\n");
  await writeFile(resolve(root, "agent", "doc", "linked.md"), "MODULE LINKED DOC\n");
  await writeFile(resolve(root, "graph", "doc", "outside.md"), "OUTSIDE MODULE DOC\n");
  await writeFile(resolve(root, "graphle", "shared.md"), "SHARED DOC\n");

  try {
    const workflow = createWorkflow(root, promptPath);
    workflow.modules = {
      agent: {
        allowedSharedPaths: [resolve(root, "graphle")],
        docs: ["./agent/doc/module-default.md"],
        id: "agent",
        path: resolve(root, "agent"),
      },
    };

    const resolvedWithLabels = await resolveIssueContext({
      baseSelection: { agent: "execute", profile: "execute" },
      issue: {
        ...createIssue(`Issue refs:

- \`./agent/doc/linked.md\`
- \`./graphle/shared.md\`
- \`./graph/doc/outside.md\`
`),
        labels: ["graphle", "agent"],
      },
      repoRoot: root,
      workflow,
    });

    expect(resolvedWithLabels.bundle.docs.map((doc) => doc.id)).toEqual([
      "builtin:graphle.agent.execute.default",
      "builtin:graphle.context.discovery",
      "builtin:graphle.linear.status-updates",
      "builtin:graphle.core.validation",
      "builtin:graphle.core.git-safety",
      "context.entrypoint",
      "./agent/doc/module-default.md",
      "./agent/doc/linked.md",
      "./graphle/shared.md",
      "issue.context",
    ]);
    expect(resolvedWithLabels.warnings).toEqual([
      "Issue doc reference is outside module scope: ./graph/doc/outside.md",
    ]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("resolveIssueContext assembles the graph module bundle and keeps refs within graph scope", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "context-"));
  const promptPath = resolve(root, "graphle.md");
  await mkdir(resolve(root, "agent", "doc"), { recursive: true });
  await mkdir(resolve(root, "graphle", "graph"), { recursive: true });
  await mkdir(resolve(root, "graphle", "project"), { recursive: true });
  await writeFile(promptPath, "LOCAL {{ selection.agent }} {{ selection.profile }}\n");
  await writeFile(resolve(root, "graphle", "graph", "overview.md"), "GRAPH Graphle OVERVIEW DOC\n");
  await writeFile(resolve(root, "graphle", "graph", "architecture.md"), "GRAPH ARCHITECTURE DOC\n");
  await writeFile(resolve(root, "graphle", "graph", "linked.md"), "GRAPH LINKED DOC\n");
  await writeFile(resolve(root, "graphle", "project", "shared.md"), "SHARED DOC\n");
  await writeFile(resolve(root, "agent", "doc", "outside.md"), "AGENT OUTSIDE DOC\n");

  try {
    const workflow = createWorkflow(root, promptPath);
    workflow.modules = {
      graph: {
        allowedSharedPaths: [
          resolve(root, "graphle", "project"),
          resolve(root, "graphle", "graph"),
        ],
        docs: [
          "./graphle/graph/overview.md",
          "./graphle/graph/overview.md",
          "./graphle/graph/architecture.md",
        ],
        id: "graph",
        path: resolve(root, "graph"),
      },
    };

    const resolved = await resolveIssueContext({
      baseSelection: { agent: "execute", profile: "execute" },
      issue: {
        ...createIssue(`Issue refs:

- \`./graphle/graph/linked.md\`
- \`./graphle/project/shared.md\`
- \`./agent/doc/outside.md\`
`),
        hasChildren: true,
        labels: ["graphle", "graph"],
      },
      repoRoot: root,
      workflow,
    });

    expect(resolved.selection).toEqual({
      agent: "execute",
      profile: "execute",
    });
    expect(resolved.bundle.docs.map((doc) => doc.id)).toEqual([
      "builtin:graphle.agent.execute.default",
      "builtin:graphle.context.discovery",
      "builtin:graphle.linear.status-updates",
      "builtin:graphle.core.validation",
      "builtin:graphle.core.git-safety",
      "context.entrypoint",
      "./graphle/graph/overview.md",
      "./graphle/graph/architecture.md",
      "./graphle/graph/linked.md",
      "./graphle/project/shared.md",
      "issue.context",
    ]);
    expect(resolved.warnings).toEqual([
      "Issue doc reference is outside module scope: ./agent/doc/outside.md",
    ]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("resolveIssueContext uses review defaults for review-routed tasks", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "context-"));
  const promptPath = resolve(root, "graphle.md");
  await mkdir(resolve(root, "graphle", "context"), { recursive: true });
  await writeFile(promptPath, "LOCAL {{ selection.agent }} {{ selection.profile }}\n");
  await writeFile(resolve(root, "graphle", "context", "overview.md"), "OVERVIEW DOC\n");

  try {
    const workflow = createWorkflow(root, promptPath);
    const resolved = await resolveIssueContext({
      baseSelection: { agent: "review", profile: "review" },
      issue: {
        ...createIssue("Review the landed task"),
        hasParent: true,
        id: "task-1",
        identifier: "OPE-88",
        parentIssueIdentifier: "OPE-77",
        state: "In Review",
        streamIssueIdentifier: "OPE-70",
      },
      repoRoot: root,
      workflow,
    });
    const rendered = renderPrompt(renderContextBundle(resolved.bundle), {
      attempt: 1,
      issue: resolved.issue,
      selection: resolved.selection,
      worker: { count: 1, id: "OPE-88", index: 0 },
      workspace: createWorkspace(root),
    });

    expect(resolved.selection).toEqual({ agent: "review", profile: "review" });
    expect(resolved.bundle.docs.map((doc) => doc.id)).toEqual([
      "builtin:graphle.agent.review.default",
      "builtin:graphle.context.discovery",
      "builtin:graphle.linear.status-updates",
      "builtin:graphle.core.validation",
      "builtin:graphle.core.git-safety",
      "context.entrypoint",
      "issue.context",
    ]);
    expect(rendered).toContain("You are the Graphle Review Agent.");
    expect(rendered).toContain("LOCAL review review");
    expect(rendered).toContain("Commit: OPE-77");
    expect(rendered).toContain("Branch: OPE-70");
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
