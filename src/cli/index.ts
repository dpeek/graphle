#! /usr/bin/env bun

import { runAgentCli } from "@io/core/agent";

import { runTask } from "./task.js";

async function run([cmd, ...args]: string[]) {
  switch (cmd) {
    case "agent":
      return runAgentCli(args);
    case "task":
      return runTask(args);
  }
}

await run(Bun.argv.slice(2));
