---
name: Graph kernel schema
description: "Schema authoring, normalized field trees, and predicate authority metadata in @io/graph-kernel."
last_updated: 2026-04-02
---

# Graph kernel schema

## Read this when

- you are changing `defineType()`, `defineScalar()`, or `defineEnum()`
- you need to understand authored keys before stable ids are applied
- you are touching field authority metadata, secret-field metadata, or fallback policy lowering

## Main source anchors

- `../src/schema.ts`: public schema helpers and normalized contract types
- `../src/schema.test.ts`: end-to-end examples of authoring and id application
- `../src/index.ts`: root export names exposed from the package

## What this layer owns

- entity, scalar, and enum definition helpers
- normalized field-tree shape with one durable authored key per nested branch
- field-level authority metadata and fallback policy descriptor lowering
- lightweight hook and validation contracts that stay attached to field definitions

It does not bootstrap schema into facts, enforce policy at runtime, or provide typed client helpers. Those layers live above `@io/graph-kernel`.

## Type authoring model

- `defineType()` takes readable authored keys and normalizes nested field trees.
- `defineScalar()` keeps encode/decode logic with the scalar definition.
- `defineEnum()` materializes durable option keys as `${enumKey}.${alias}` unless the option already supplies an explicit `key`.
- `RangeRef` can be either a raw string key or a type-like object with `values.key`.

## Field-tree normalization

- Every nested branch gets a non-enumerable `fieldsMeta` record with its authored key. `fieldTreeKey()` reads that key.
- `fieldTreeId()` falls back to the authored key until stable ids have been applied.
- Predicate definitions keep their authored `key` and optional runtime `id`. `edgeId()` reads the resolved `id` when present and otherwise falls back to the authored key.
- `rangeOf()` follows the same pattern for field ranges: authored key before id application, resolved id after it.

The authored field-tree shape is still the source of truth. Resolution adds ids to that shape; it does not replace it with a different runtime tree.

## Predicate metadata

- Cardinality is limited to `one`, `one?`, and `many`.
- Field definitions may carry `createOptional`, `onCreate`, `onUpdate`, and `validate`.
- `fieldVisibility()` defaults to `replicated`.
- `fieldWritePolicy()` defaults to `client-tx`.
- `fieldPolicyDescriptor()` lowers authored policy metadata into the flattened descriptor shape consumed by policy and sync layers.
- `createFallbackPolicyDescriptor()` synthesizes a stable default descriptor when authored policy metadata is absent.
- `fieldPolicyFallbackContractVersion` must change if the fallback lowering changes meaning for existing stored data.

## Secret-backed fields

- Secret-backed fields are identified by `authority.secret.kind === "sealed-handle"`.
- The kernel only owns metadata for those fields: metadata visibility plus optional reveal and rotate capability names.
- `fieldSecretMetadataVisibility()` defaults to the field's transport visibility unless the secret metadata overrides it.

The kernel does not own plaintext storage or reveal flows. It only preserves the schema contract that higher layers consume.

## Practical rules

- Author with readable keys first. Do not hard-code resolved ids in package code.
- Use `rangeOf()` when you need one helper that works both before and after `applyGraphIdMap()`.
- Keep predicate-specific hooks and validators on the field definition. Do not move them into the store layer.
- Keep schema-level metadata here. Transport behavior and persisted-authority behavior do not belong in this package.
