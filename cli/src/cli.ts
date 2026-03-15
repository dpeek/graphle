#! /usr/bin/env bun

import { runAgentCli } from "@io/agent";
import { configurePackage, createPackage } from "./create.js";
import { install } from "./install.js";
import { runTask } from "./task.js";
import { setExludeFiles } from "./vscode.js";

async function run([cmd, ...args]: string[]) {
  switch (cmd) {
    case "agent":
      return runAgentCli(args);
    case "create":
      return createPackage(args[0]);
    case "configure":
      return configurePackage(args[0]);
    case "hide":
      return setExludeFiles(true);
    case "show":
      return setExludeFiles(false);
    case "install":
      return install(args);
    case "task":
      return runTask(args);
  }
}

await run(Bun.argv.slice(2));
