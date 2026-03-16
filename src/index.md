# IO Overview

## Purpose

`io` is the repo-level package. It owns the shared project map: agent runtime,
context and config resolution, the stream/feature/task workflow contract, and
the graph-first application direction the rest of the workspace is proving.

## Docs

- `../io.md`
- `./agent/skill/backlog.md`
- `./agent/index.md`
- `./agent/tui/index.md`
- `./graph/index.md`
- `./app/index.md`

## Layout

- `../io.ts`: repo config, context registry, profiles, modules, routing
- `../io.md`: repo-local execution guidance included in prompt context
- `./agent/skill/backlog.md`: stream, feature, and task planning plus backlog-editing contract
- `./agent/index.md`: agent runtime overview, scheduler layout, and operator surfaces
- `./agent/tui/index.md`: operator-facing TUI layout and retained runtime display
- `./graph/index.md`: graph package layout including engine, adapters, taxonomies, and focused subdocs
- `./app/index.md`: app proof surface, experiment wiring, and graph-backed UI entrypoints
- `./index.md`: repo map and context entrypoint
- `../src/agent/`: scheduler, context assembly, tracker integration, retained runtime,
  and the operator TUI
- `../src/config/`, `../src/lib/`: shared config loading and typed config surface
- `../src/graph/`, `../src/app/`: graph runtime, schema-driven UI proofs, application surfaces
- `../src/cli/`: operator command surface
