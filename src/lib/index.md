# Lib Overview

## Purpose

`lib` owns the shared config language, loader behavior, env helpers, and small
runtime utilities used across repo domains.

## Docs

- `../index.md`

## Layout

- `../../src/lib/config.ts`: typed config helpers and loader
- `../../src/lib/env.ts`: env-backed config helpers
- `../../src/lib/log.ts`, `../../src/lib/process.ts`: shared runtime utilities
- `../../src/lib/index.ts`: package exports
- `../../src/lib/*.test.ts`: contract tests
