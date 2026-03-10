# IO TypeScript Config And Context Model

Status: Current

## What This Topic Covers

This topic covers the repo entrypoint layer for IO:

- structured config in `io.ts`
- repo-local instructions in `io.md`
- built-in docs, profiles, and issue routing
- shared config loading across `agent` and `cli`

If a change affects how IO starts, loads context, selects agents, or resolves
repo docs, start here.

## Current Entry Points

Main repo entrypoints:

- `io.ts`
- `io.md`

Shared config and loader code:

- `lib/src/config.ts`
- `config/src/index.ts`

Runtime context and routing code:

- `agent/src/workflow.ts`
- `agent/src/issue-routing.ts`
- `agent/src/builtins.ts`

Context-model docs:

- `agent/doc/context.md`
- `agent/doc/context-defaults.md`

Related consumers:

- `agent/src/server.ts`
- `cli/src/install.ts`

## Current Model

IO now treats the root config and context surface as:

- `io.ts`
  - the typed structured config source
- `io.md`
  - the default repo-local instruction layer

The runtime then builds a context bundle from:

1. built-in docs selected by agent/profile
2. `io.md`
3. repo-local project docs
4. docs linked from the issue body
5. synthesized issue context where needed

The current built-ins and routing behavior live in the runtime, not in ad hoc
prompt bodies:

- built-ins: `agent/src/builtins.ts`
- routing: `agent/src/issue-routing.ts`
- workflow loading and resolution: `agent/src/workflow.ts`

Compatibility still exists for older entrypoints, but the project direction is
clear: `io.ts` plus `io.md` is the primary model.

## Where Repo Context Lives

For this repo specifically, the main project context entry points are currently
the topic docs in `llm/topic/` rather than a separate `io/context/` tree.

Start with:

- `llm/topic/overview.md`
- `llm/topic/agent-opentui.md`
- `llm/topic/io-ts-config.md`

Use issue-linked docs and stream-specific docs after those.

## What To Change Where

If you need to change runtime knobs or repo defaults:

- edit `io.ts`

If you need to change short repo-local instructions:

- edit `io.md`

If you need to change the shared config language, loader, or env-backed value
handling:

- edit `lib/src/config.ts`

If you need to change how context bundles are resolved or how issue metadata
selects agents and profiles:

- edit `agent/src/workflow.ts`
- edit `agent/src/issue-routing.ts`
- edit `agent/src/builtins.ts`
- review `agent/doc/context.md`

If you need to change install-time config consumption:

- edit `cli/src/install.ts`

## Long-Term Goal

The long-term goal is one explicit, typed, inspectable project model where:

- config is authored in TypeScript
- context selection is declarative rather than hidden in prompt templates
- agent/profile routing is visible and debuggable
- the same config metadata can eventually feed graph-backed inspection and
  editing

In other words, IO should move away from "one giant workflow prompt" and toward
one reusable system for config, context, routing, and future structured UI.
