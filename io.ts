import { defineIoConfig, env, linearTracker } from "@io/core/lib/config";

export default defineIoConfig({
  agent: {
    maxConcurrentAgents: 3,
    maxTurns: 1,
  },
  codex: {
    approvalPolicy: "never",
    command: "codex app-server",
    threadSandbox: "workspace-write",
  },
  hooks: {
    afterCreate: "bun install",
  },
  context: {
    entrypoint: "./io/project/overview.md",
    docs: {
      "project.backlog": "./io/project/backlog.md",
      "project.goals": "./io/project/goals.md",
      "project.module-stream-workflow-plan": "./io/agent/module-stream-workflow-plan.md",
      "project.overview": "./io/project/overview.md",
      "project.workflow": "./io/project/workflow.md",
    },
    profiles: {
      backlog: {
        include: [
          "builtin:io.agent.backlog.default",
          "builtin:io.context.discovery",
          "builtin:io.linear.status-updates",
          "builtin:io.core.git-safety",
          "project.overview",
          "project.workflow",
          "project.backlog",
          "project.goals",
        ],
      },
      execute: {
        include: [
          "builtin:io.agent.execute.default",
          "builtin:io.context.discovery",
          "builtin:io.linear.status-updates",
          "builtin:io.core.validation",
          "builtin:io.core.git-safety",
          "project.overview",
          "project.workflow",
        ],
      },
    },
  },
  modules: {
    agent: {
      allowedSharedPaths: ["./io/project", "./io/agent"],
      docs: ["./io/agent/overview.md", "./io/agent/module-stream-workflow-plan.md"],
      path: "./src/agent",
    },
    app: {
      allowedSharedPaths: ["./io/project", "./io/app", "./io/graph"],
      docs: ["./io/app/overview.md"],
      path: "./src/app",
    },
    cli: {
      allowedSharedPaths: ["./io/project", "./io/cli"],
      docs: ["./io/cli/overview.md"],
      path: "./src/cli",
    },
    config: {
      allowedSharedPaths: ["./io/project", "./io/config", "./io/lib"],
      docs: ["./io/config/overview.md"],
      path: "./src/config",
    },
    graph: {
      allowedSharedPaths: ["./io/project", "./io/graph"],
      docs: ["./io/graph/overview.md", "./io/graph/architecture.md"],
      path: "./src/graph",
    },
    lib: {
      allowedSharedPaths: ["./io/project", "./io/lib"],
      docs: ["./io/lib/overview.md"],
      path: "./src/lib",
    },
  },
  install: {
    brews: [
      "fzf",
      "ripgrep",
      "bat",
      "starship",
      "fd",
      "eza",
      "btop",
      "gh",
      "node",
      "pnpm",
      "tailscale",
      "dicklesworthstone/tap/cass",
      "--cask codex",
      "--cask codex-app",
      "--cask github",
      "--cask 1password",
      "--cask 1password-cli",
      "--cask tailscale-app",
      "--cask raycast",
      "--cask orbstack",
      "--cask cursor",
      "--cask google-chrome",
      "--cask ghostty",
      "--cask figma",
      "--cask slack",
      "--cask linear-linear",
      "--cask claude",
      "--cask claude-code",
    ],
  },
  issues: {
    defaultAgent: "execute",
    defaultProfile: "execute",
    routing: [
      {
        if: {
          labelsAny: ["backlog", "planning"],
        },
        agent: "backlog",
        profile: "backlog",
      },
    ],
  },
  tracker: linearTracker({
    activeStates: ["Todo", "In Progress"],
    apiKey: env.secret("LINEAR_API_KEY"),
    projectSlug: env.string("LINEAR_PROJECT_SLUG"),
  }),
  workspace: {
    root: ".io",
  },
});
