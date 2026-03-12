# Managed Stream Comment Trigger Contract

Status: Accepted target for implementation.

## Purpose

This document defines the stable parser and writeback contract for `@io ...`
comments on managed parent issues.

## Trigger Scope

`@io` comments apply only to managed parent issues that satisfy the label and
module rules in [`./managed-stream-goals.md`](./managed-stream-goals.md).

Rules:

- only top-level comments on managed parent issues can trigger managed actions
- child issues ignore `@io` comments unless a later contract adds explicit
  child-scope commands
- one comment requests one command
- the first non-empty line is the command line; later lines are optional
  command arguments
- if the parent is not managed, the runtime should reply with a blocked result
  and make no writes

## Accepted Command Shape

The first version uses a narrow line-plus-YAML shape:

```md
@io <command>
docs:
  - ./agent/io/goals.md
dryRun: true
note: Refresh after the latest scope review
```

Rules:

- the first non-empty line must start with `@io `
- `<command>` is a single lowercase token
- the remaining body, when present, must parse as one YAML mapping
- unknown commands or unknown top-level keys are rejected with a reply comment
- commands never rely on free-form natural-language parsing outside the
  accepted keys

## Initial Command Set

### `@io backlog`

Refresh the parent description toward the shared stream template and refresh the
speculative child backlog.

Write surface:

- parent issue description
- child issues under the parent

### `@io status`

Report the current managed-stream state without rewriting the issue body.

Write surface:

- reply comment only

### `@io help`

Return the accepted commands and key validation rules.

Write surface:

- reply comment only

## Execution Model

For each accepted trigger:

1. resolve the parent issue, child issues, module identity, and referenced docs
2. validate that the parent still satisfies the managed-parent contract
3. execute only the write surfaces allowed for that command
4. post one reply comment that reports `updated`, `noop`, or `blocked`
5. leave the original trigger comment untouched

If multiple unhandled trigger comments exist on one parent, process them in
comment order so the command stream stays deterministic.

## Reply Comment Shape

Every handled trigger should produce one concise reply with a stable shape:

```md
<!-- io-managed:comment-result -->
Command: backlog
Result: updated
Target: OPE-122 / agent

- Updated the parent description
- Left existing in-progress child issues untouched
- Warning: skipped one requested write because the parent is not eligible
```

Rules:

- keep the result summary operator-readable first
- mention each written surface or explicit no-op
- surface blocking conditions or validation warnings directly in the reply

## Safety Rules

- never treat any region of the parent description as a protected marker block
- never infer module identity from `io`; require the module label match
- reject ambiguous module labels instead of choosing one silently
- allow `dryRun: true` to compute and report the intended changes without
  writing them
- treat repeated equivalent commands as valid no-ops, not as errors
