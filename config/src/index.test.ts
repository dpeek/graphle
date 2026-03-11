import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "bun:test";

import config from "./index.js";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("@io/config re-exports the repo root config", () => {
  expect(config.install?.brews).toContain("ripgrep");
});

test("@io/config exposes the repo context bundle and routing defaults", () => {
  expect(config.context?.entrypoint).toBe("./io.md");
  expect(config.context?.docs).toEqual({
    "project.architecture": "./llm/topic/architecture.md",
    "project.managed-stream-backlog": "./llm/topic/managed-stream-backlog.md",
    "project.overview": "./llm/topic/project-overview.md",
    "project.workflow-migration": "./llm/topic/workflow-migration.md",
  });
  expect(config.context?.profiles?.backlog?.include).toContain("project.managed-stream-backlog");
  expect(config.context?.profiles?.backlog?.include).toContain("project.workflow-migration");
  expect(config.modules?.agent).toEqual({
    allowedSharedPaths: ["./llm/topic"],
    docs: ["./llm/topic/agent.md", "./agent/doc/stream-workflow.md"],
    path: "./agent",
  });
  expect(config.issues).toEqual({
    defaultAgent: "execute",
    defaultProfile: "execute",
    routing: [
      {
        agent: "backlog",
        if: {
          labelsAny: ["backlog", "planning"],
        },
        profile: "backlog",
      },
    ],
  });

  for (const path of Object.values(config.context?.docs ?? {})) {
    expect(existsSync(resolve(repoRoot, path))).toBe(true);
  }
  for (const module of Object.values(config.modules ?? {})) {
    expect(existsSync(resolve(repoRoot, module.path))).toBe(true);
  }
});

test("repo managed stream backlog doc captures expansion, maintenance, and operator output rules", () => {
  const path = resolve(repoRoot, "./llm/topic/managed-stream-backlog.md");
  const content = readFileSync(path, "utf8");

  expect(content).toContain("## Stable Child Payload");
  expect(content).toContain("blockedBy");
  expect(content).toContain("top the stream back up to about five planned tasks");
  expect(content).toContain("Do not destructively rewrite children that are already active or completed.");
  expect(content).toContain("## Cross-Module Exception");
  expect(content).toContain("## Operator-Visible Output");
});
