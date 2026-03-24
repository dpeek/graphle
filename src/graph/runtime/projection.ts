import {
  createModuleSyncScope,
  type ModuleSyncScope,
  type ModuleSyncScopeRequest,
  type SyncScope,
  type SyncScopeRequest,
} from "./sync/index.js";

export const projectionSourceScopeKinds = [
  "graph",
  "module",
  "entity-neighborhood",
  "collection",
  "work-queue",
  "context-bundle",
  "share-projection",
] as const;

export type ProjectionSourceScopeKind = (typeof projectionSourceScopeKinds)[number];

export const projectionKinds = [
  "collection-index",
  "time-range-index",
  "context-bundle",
  "outbound-share",
] as const;

export type ProjectionKind = (typeof projectionKinds)[number];

export const projectionRebuildStrategies = ["full", "checkpointed"] as const;

export type ProjectionRebuildStrategy = (typeof projectionRebuildStrategies)[number];

export const projectionVisibilityModes = ["policy-filtered", "share-surface"] as const;

export type ProjectionVisibilityMode = (typeof projectionVisibilityModes)[number];

export type ProjectionDependencyKey =
  | `predicate:${string}`
  | `projection:${string}`
  | `scope:${string}`
  | `shard:${string}`;

export interface ModuleReadScopeDefinition {
  readonly kind: "module";
  readonly moduleId: string;
  readonly scopeId: string;
  readonly definitionHash: string;
}

export interface ProjectionSpec {
  readonly projectionId: string;
  readonly kind: ProjectionKind;
  readonly definitionHash: string;
  readonly sourceScopeKinds: readonly ProjectionSourceScopeKind[];
  readonly dependencyKeys: readonly ProjectionDependencyKey[];
  readonly rebuildStrategy: ProjectionRebuildStrategy;
  readonly visibilityMode: ProjectionVisibilityMode;
}

function assertNonEmptyString(value: string, label: string): void {
  if (value.length === 0) {
    throw new TypeError(`${label} must not be empty.`);
  }
}

function assertUniqueValues(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    assertNonEmptyString(value, label);
    if (seen.has(value)) {
      throw new TypeError(`${label} must not contain duplicate values.`);
    }
    seen.add(value);
  }
}

export function defineModuleReadScopeDefinition<const T extends ModuleReadScopeDefinition>(
  definition: T,
): Readonly<T> {
  assertNonEmptyString(definition.moduleId, "moduleId");
  assertNonEmptyString(definition.scopeId, "scopeId");
  assertNonEmptyString(definition.definitionHash, "definitionHash");

  return Object.freeze({ ...definition });
}

export function createModuleReadScopeRequest(
  definition: ModuleReadScopeDefinition,
): ModuleSyncScopeRequest {
  return Object.freeze({
    kind: "module",
    moduleId: definition.moduleId,
    scopeId: definition.scopeId,
  });
}

export function createModuleReadScope(
  definition: ModuleReadScopeDefinition,
  policyFilterVersion: string,
): ModuleSyncScope {
  assertNonEmptyString(policyFilterVersion, "policyFilterVersion");
  return createModuleSyncScope({
    moduleId: definition.moduleId,
    scopeId: definition.scopeId,
    definitionHash: definition.definitionHash,
    policyFilterVersion,
  });
}

export function matchesModuleReadScopeRequest(
  scope: SyncScope | SyncScopeRequest,
  definition: Pick<ModuleReadScopeDefinition, "moduleId" | "scopeId">,
): boolean {
  return (
    scope.kind === "module" &&
    scope.moduleId === definition.moduleId &&
    scope.scopeId === definition.scopeId
  );
}

export function matchesModuleReadScope(
  scope: SyncScope,
  definition: ModuleReadScopeDefinition,
): boolean {
  return (
    scope.kind === "module" &&
    scope.moduleId === definition.moduleId &&
    scope.scopeId === definition.scopeId &&
    scope.definitionHash === definition.definitionHash
  );
}

export function defineProjectionSpec<const T extends ProjectionSpec>(spec: T): Readonly<T> {
  assertNonEmptyString(spec.projectionId, "projectionId");
  assertNonEmptyString(spec.definitionHash, "definitionHash");
  if (spec.sourceScopeKinds.length === 0) {
    throw new TypeError("sourceScopeKinds must not be empty.");
  }
  if (spec.dependencyKeys.length === 0) {
    throw new TypeError("dependencyKeys must not be empty.");
  }

  assertUniqueValues(spec.sourceScopeKinds, "sourceScopeKinds");
  assertUniqueValues(spec.dependencyKeys, "dependencyKeys");

  return Object.freeze({
    ...spec,
    sourceScopeKinds: Object.freeze([...spec.sourceScopeKinds]),
    dependencyKeys: Object.freeze([...spec.dependencyKeys]),
  });
}

export function defineProjectionCatalog<const T extends readonly ProjectionSpec[]>(
  projections: T,
): Readonly<T> {
  if (projections.length === 0) {
    throw new TypeError("Projection catalog must not be empty.");
  }

  const projectionIds = projections.map((projection) => projection.projectionId);
  assertUniqueValues(projectionIds, "projectionId");

  return Object.freeze([...projections]) as Readonly<T>;
}
