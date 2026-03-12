# Graph Overview

## Purpose

`graph` owns the reusable graph runtime: schema, store, validation, sync, type modules, and the typed client surface.

## Docs

- `./goals.md`
- `../doc/overview.md`
- `../doc/big-picture.md`
- `../doc/validation.md`
- `../doc/sync.md`
- `../doc/type-modules.md`

## Layout

- `../src/graph/`: core runtime, schema, client, store, sync, bootstrap, type-module APIs
- `../src/type/`: built-in scalar, enum, and field helper modules
- `../src/index.ts`: public package exports
- `../doc/`: architecture and roadmap docs
