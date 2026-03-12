# Managed Stream Comments

## Purpose

This document is the entry point for agents working on `@io` comment parsing, managed command execution, or reply-comment behavior.

## Current Trigger Scope

`@io` comments currently apply only to top-level comments on managed parent issues.

Current scope rules:

- child issues ignore `@io` commands
- one comment requests one command
- the first non-empty line is always the command line
- non-managed parents still receive a reply, but the result is blocked and no managed writes happen

## Current Command Shape

The parser in `../src/managed-comments.ts` already expects a narrow line-plus-YAML form:

```md
@io <command>
docs:

- ./agent/io/overview.md
  dryRun: true
  note: Refresh after the latest scope review
```

Current accepted payload keys:

- `docs`
- `dryRun`
- `note`

Unknown commands, malformed YAML, or unknown top-level keys already turn into parse-error replies rather than partial guessing.

## Current Command Set

- `@io backlog`: may refresh the parent description and sync speculative child backlog
- `@io status`: reports the current managed-stream state without rewriting the issue body
- `@io help`: reports accepted commands and payload keys

`docs` can narrow or extend the doc list used for a backlog refresh, and `dryRun: true` computes the result without applying tracker writes.

## Current Execution Model

`../src/service.ts` currently handles managed comments by:

1. polling managed parent issues for top-level comments
2. parsing `@io` commands
3. checking whether the exact comment body hash was already handled
4. validating current managed-parent eligibility and module identity
5. applying only the write surface allowed for that command
6. posting one reply comment and recording the handled comment state

Comment dedupe is retained in per-issue runtime files by `../src/comment-state.ts`.

## Current Reply Shape

Reply comments already use one stable machine marker and a human-readable summary:

- `<!-- io-managed:comment-result -->`
- `Command: ...`
- `Result: ...`
- `Target: ...`
- bullet lines summarizing writes, no-ops, or warnings

Current result values in the code are:

- `blocked`
- `noop`
- `partial`
- `updated`

## Current Safety Rules

- managed commands do not treat any parent-description region as machine-protected
- module identity must come from labels plus workflow config, not inference from comment text
- repeated equivalent commands are valid no-ops
- command writes remain narrow and explicit enough to summarize in one reply

## Roadmap

- improve status output without widening the command surface
- decide whether additional managed commands are worth supporting
- clarify which reply fields should be treated as stable machine-readable output
- keep dry-run behavior aligned with real writes as the backlog sync surface grows

## Future Work Suggestions

1. Add one table mapping each command to its allowed write surfaces.
2. Document which parse errors are expected to remain stable for operator feedback.
3. Add an example of dry-run backlog output versus applied backlog output.
4. Clarify whether handled-comment retention should ever expire by policy rather than count.
5. Capture when child-scope commands would justify a separate contract instead of extending this one.
