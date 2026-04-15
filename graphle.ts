import { defineIoConfig, env, linearTracker } from "@dpeek/graphle-cli/config";

const reviewPlanningEnabled = false;

export default defineIoConfig({
  agent: {
    maxConcurrentAgents: 4,
    maxTurns: 1,
  },
  codex: {
    approvalPolicy: "never",
    command: "AGENT=1 codex app-server",
    threadSandbox: "workspace-write",
  },
  hooks: {
    afterCreate: "bun install",
  },
  context: {
    entrypoint: "./graphle.md",
    docs: {
      "project.backlog": "./doc/agent/backlog.md",
      "project.mcp": "./lib/graphle-cli/doc/graph-mcp.md",
      "project.overview": "./doc/index.md",
      "project.review": "./doc/agent/review.md",
      "project.workflow": "./lib/graphle-cli/doc/agent-workflow.md",
    },
    profiles: {
      backlog: {
        include: [
          "builtin:graphle.agent.backlog.default",
          "builtin:graphle.context.discovery",
          "builtin:graphle.linear.status-updates",
          "builtin:graphle.core.git-safety",
          "project.overview",
          "project.workflow",
          "project.backlog",
          "project.goals",
        ],
      },
      execute: {
        include: [
          "builtin:graphle.agent.execute.default",
          "builtin:graphle.context.discovery",
          "builtin:graphle.linear.status-updates",
          "builtin:graphle.core.validation",
          "builtin:graphle.core.git-safety",
          "project.overview",
          "project.workflow",
        ],
      },
      review: {
        include: [
          "builtin:graphle.agent.review.default",
          "builtin:graphle.context.discovery",
          "builtin:graphle.linear.status-updates",
          "builtin:graphle.core.validation",
          "builtin:graphle.core.git-safety",
          "project.overview",
          "project.workflow",
          "project.review",
        ],
      },
    },
  },
  modules: {
    agent: {
      allowedSharedPaths: ["./lib/graphle-cli/src"],
      docs: ["./lib/graphle-cli/doc/agent-runtime.md", "./lib/graphle-cli/doc/agent-workflow.md"],
      path: "./lib/graphle-cli/src/agent",
    },
    graph: {
      allowedSharedPaths: ["./lib/app/src"],
      docs: [
        "./lib/graphle-kernel/doc/runtime-stack.md",
        "./lib/graphle-kernel/doc/roadmap.md",
        "./lib/graphle-client/doc/roadmap.md",
        "./lib/graphle-surface/doc/roadmap.md",
        "./lib/graphle-authority/doc/roadmap.md",
        "./lib/graphle-module-core/doc/icons-and-svg.md",
      ],
      path: "./lib/app/src/graph",
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
      ...(reviewPlanningEnabled
        ? [
            {
              if: {
                hasChildren: false,
                hasParent: true,
                stateIn: ["In Review"],
              },
              agent: "review" as const,
              profile: "review",
            },
          ]
        : []),
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
    activeStates: ["Todo", "In Progress", ...(reviewPlanningEnabled ? ["In Review"] : [])],
    apiKey: env.secret("LINEAR_API_KEY"),
    projectSlug: env.string("LINEAR_PROJECT_SLUG"),
  }),
  workspace: {
    root: "./tmp/workspace",
  },
});
