# CLI Overview

The `io` runs scripts in `./src/task/*` calling an exported function `run` and passing argv.

Current graph MCP entrypoint:

- `io mcp graph [--url <url>] [--allow-writes]` starts the stdio MCP server against the Worker-backed graph HTTP routes.
- `--allow-writes` registers the gated `graph.createEntity`, `graph.updateEntity`, and `graph.deleteEntity` tools.
