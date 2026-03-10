import { createLogger, handleExit } from "@io/lib";

import { AgentService } from "./service.js";
import { loadWorkflowFile } from "./workflow.js";
import { readIssueRuntimeState } from "./workspace.js";
import { createAgentTui } from "./tui.js";

function printHelp() {
  console.log(`Usage:
  io agent start [entrypointPath] [--once]
  io agent tui [entrypointPath] [--once]
  io agent tail <issue> [entrypointPath]
  io agent validate [entrypointPath]

Defaults:
  ./io.ts + ./io.md
Compatibility:
  falls back to ./io.json during migration, then ./WORKFLOW.md for the legacy entrypoint
  `);
}

type StartCommandOptions = {
  once: boolean;
  workflowPath?: string;
};

function parseStartOptions(args: string[]): StartCommandOptions {
  const options: StartCommandOptions = { once: false };
  for (let index = 0; index < args.length; index++) {
    const value = args[index];
    if (!value) {
      continue;
    }
    if (value === "--once") {
      options.once = true;
      continue;
    }
    if (!value.startsWith("--") && !options.workflowPath) {
      options.workflowPath = value;
    }
  }
  return options;
}

async function runAgentService(options: StartCommandOptions, mode: "start" | "tui") {
  const tui = mode === "tui" ? createAgentTui() : undefined;
  const service = new AgentService({
    ...options,
    stdoutEvents: mode !== "tui",
  });
  if (tui) {
    service.observeSessionEvents(tui.observe);
  }

  let stopped = false;
  const stop = async () => {
    if (stopped) {
      return;
    }
    stopped = true;
    tui?.stop();
    await service.stop();
  };

  handleExit(stop);

  try {
    tui?.start();
    await service.start();
  } finally {
    await stop();
  }
}

export async function runAgentCli(args: string[]) {
  const [command = "start", ...rest] = args;
  switch (command) {
    case "start": {
      const options = parseStartOptions(rest);
      await runAgentService(options, "start");
      return;
    }
    case "tui": {
      const options = parseStartOptions(rest);
      await runAgentService(options, "tui");
      return;
    }
    case "validate": {
      const result = await loadWorkflowFile(rest[0], process.cwd());
      if (!result.ok) {
        for (const error of result.errors) {
          console.error(`${error.path}: ${error.message}`);
        }
        process.exitCode = 1;
        return;
      }
      const log = createLogger({ pkg: "agent" });
      log.info("workflow.valid", {
        activeStates: result.value.tracker.activeStates,
        configPath: result.value.entrypoint.configPath,
        entrypointKind: result.value.entrypoint.kind,
        promptPath: result.value.entrypoint.promptPath,
        projectSlug: result.value.tracker.projectSlug,
        workspaceRoot: result.value.workspace.root,
      });
      return;
    }
    case "tail": {
      const [issueIdentifier, workflowArg] = rest;
      if (!issueIdentifier || issueIdentifier.startsWith("--")) {
        throw new Error("Usage: io agent tail <issue> [entrypointPath]");
      }
      const result = await loadWorkflowFile(workflowArg, process.cwd());
      if (!result.ok) {
        for (const error of result.errors) {
          console.error(`${error.path}: ${error.message}`);
        }
        process.exitCode = 1;
        return;
      }
      const issueState = await readIssueRuntimeState(result.value.workspace.root, issueIdentifier);
      if (!issueState) {
        console.error(`No retained issue output for ${issueIdentifier}`);
        process.exitCode = 1;
        return;
      }
      const proc = Bun.spawn({
        cmd: ["tail", "-n", "200", "-f", issueState.outputPath],
        stderr: "inherit",
        stdin: "inherit",
        stdout: "inherit",
      });
      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        process.exitCode = exitCode;
      }
      return;
    }
    case "help":
      printHelp();
      return;
    default:
      throw new Error(`Unknown agent command: ${command}`);
  }
}
