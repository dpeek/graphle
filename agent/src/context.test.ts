import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { DEFAULT_BACKLOG_BUILTIN_DOC_IDS, DEFAULT_EXECUTE_BUILTIN_DOC_IDS } from "./builtins.js";
import { resolveIssueContext } from "./context.js";
import type { AgentIssue, PreparedWorkspace, Workflow } from "./types.js";
import { renderPrompt } from "./workflow.js";

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
        "project.architecture": resolve(root, "io", "context", "architecture.md"),
        "project.backlog": resolve(root, "io", "context", "backlog.md"),
        "project.overview": resolve(root, "io", "context", "overview.md"),
      },
      overrides: {},
      profiles: {
        backlog: {
          include: [...DEFAULT_BACKLOG_BUILTIN_DOC_IDS, "project.backlog"],
        },
        execute: {
          include: [...DEFAULT_EXECUTE_BUILTIN_DOC_IDS],
        },
      },
    },
    entrypoint: {
      configPath: resolve(root, "io.json"),
      kind: "io",
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
    polling: {
      intervalMs: 30_000,
    },
    promptTemplate: "LOCAL {{ selection.agent }} {{ selection.profile }}",
    tracker: {
      activeStates: ["Todo"],
      endpoint: "https://api.linear.app/graphql",
      kind: "linear",
      terminalStates: ["Done"],
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
    projectSlug: "io",
    state: "Todo",
    title: "Issue context",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

function createWorkspace(root: string): PreparedWorkspace {
  return {
    branchName: "io/ope-61",
    controlPath: root,
    createdNow: true,
    originPath: root,
    path: resolve(root, "workspace"),
    workerId: "OPE-61",
  };
}

test("resolveIssueContext applies issue hints after repo defaults and profile docs", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "context-"));
  const promptPath = resolve(root, "io.md");
  await mkdir(resolve(root, "io", "context"), { recursive: true });
  await writeFile(promptPath, "LOCAL {{ selection.agent }} {{ selection.profile }}\n");
  await writeFile(resolve(root, "io", "context", "backlog.md"), "BACKLOG PROFILE DOC\n");
  await writeFile(resolve(root, "io", "context", "architecture.md"), "ARCHITECTURE DOC\n");
  await writeFile(resolve(root, "io", "context", "overview.md"), "OVERVIEW DOC\n");
  await writeFile(resolve(root, "io", "context", "hint-extra.md"), "HINT EXTRA DOC\n");
  await writeFile(resolve(root, "io", "context", "linked.md"), "LINKED DOC\n");

  try {
    const issue = createIssue(`## Summary

<!-- io
agent: backlog
docs:
  - project.architecture
  - ./io/context/hint-extra.md
  - project.missing
-->

Important refs:

- \`project.overview\`
- \`./io/context/linked.md\`
- \`builtin:io.core.validation\`
`);
    const workflow = createWorkflow(root, promptPath);
    const resolved = await resolveIssueContext({
      baseSelection: { agent: "execute", profile: "execute" },
      issue,
      repoRoot: root,
      workflow,
    });
    const rendered = renderPrompt(resolved.promptTemplate, {
      attempt: 1,
      issue,
      selection: resolved.selection,
      worker: { count: 1, id: issue.identifier, index: 0 },
      workspace: createWorkspace(root),
    });

    expect(resolved.selection).toEqual({
      agent: "backlog",
      profile: "backlog",
    });
    expect(resolved.warnings).toEqual(["Unresolved issue doc reference: project.missing"]);
    expect(rendered).toContain("You are the IO Backlog Agent.");
    expect(rendered).not.toContain("You are the IO Execution Agent.");
    expect(rendered).toContain("LOCAL backlog backlog");
    expect(rendered).toContain("BACKLOG PROFILE DOC");
    expect(rendered).toContain("ARCHITECTURE DOC");
    expect(rendered).toContain("HINT EXTRA DOC");
    expect(rendered).toContain("OVERVIEW DOC");
    expect(rendered).toContain("LINKED DOC");
    expect(rendered).toContain("run the repo's required validation before declaring the work done");

    expect(rendered.indexOf("You are the IO Backlog Agent.")).toBeLessThan(
      rendered.indexOf("LOCAL backlog backlog"),
    );
    expect(rendered.indexOf("LOCAL backlog backlog")).toBeLessThan(
      rendered.indexOf("BACKLOG PROFILE DOC"),
    );
    expect(rendered.indexOf("BACKLOG PROFILE DOC")).toBeLessThan(
      rendered.indexOf("ARCHITECTURE DOC"),
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
