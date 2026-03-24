import {
  bootstrap,
  collectScalarCodecs,
  collectTypeIndex,
  edgeId,
  fieldPolicyDescriptor,
  isEntityType,
  type AnyTypeOutput,
  type Cardinality,
  type GraphFieldAuthority,
  type StoreSnapshot,
  type PredicatePolicyDescriptor,
  createStore,
} from "@io/core/graph";

type WebAppAuthorityGraph = Record<string, AnyTypeOutput>;

export type CompiledFieldDefinition = {
  readonly field: {
    readonly authority?: GraphFieldAuthority;
    readonly cardinality: Cardinality;
    readonly key: string;
    readonly meta?: {
      readonly label?: string;
    };
    readonly range: string;
  };
  readonly fieldLabel: string;
  readonly ownerTypeIds: ReadonlySet<string>;
  readonly pathLabel: string;
  readonly policy: PredicatePolicyDescriptor;
};

export type AuthorizationDecisionTarget = {
  readonly subjectId: string;
  readonly predicateId: string;
  readonly policy?: PredicatePolicyDescriptor | null;
};

export type CompiledGraphArtifacts = {
  readonly bootstrappedSnapshot: StoreSnapshot;
  readonly compiledFieldIndex: ReadonlyMap<string, CompiledFieldDefinition>;
  readonly scalarByKey: ReturnType<typeof collectScalarCodecs>;
  readonly typeByKey: ReturnType<typeof collectTypeIndex>;
};

const compiledGraphArtifactsCache = new WeakMap<WebAppAuthorityGraph, CompiledGraphArtifacts>();

function createFallbackPolicyDescriptor(
  field: CompiledFieldDefinition["field"],
): PredicatePolicyDescriptor {
  return {
    predicateId: edgeId(field),
    transportVisibility: field.authority?.visibility ?? "replicated",
    requiredWriteScope: field.authority?.write ?? "client-tx",
    readAudience:
      (field.authority?.visibility ?? "replicated") === "authority-only" ? "authority" : "public",
    writeAudience: "authority",
    shareable: false,
  } satisfies PredicatePolicyDescriptor;
}

function resolveCompiledFieldPolicy(
  field: CompiledFieldDefinition["field"],
): PredicatePolicyDescriptor {
  return fieldPolicyDescriptor(field) ?? createFallbackPolicyDescriptor(field);
}

function isDefinitionField(
  value: unknown,
): value is CompiledFieldDefinition["field"] & Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CompiledFieldDefinition["field"]>;
  return (
    typeof candidate.key === "string" &&
    typeof candidate.range === "string" &&
    typeof candidate.cardinality === "string"
  );
}

function getFieldLabel(field: CompiledFieldDefinition["field"]): string {
  if (field.meta?.label) return field.meta.label;
  const segments = field.key.split(":");
  return segments.at(-1) ?? field.key;
}

function flattenCompiledFieldDefinitions(
  tree: Record<string, unknown>,
  ownerTypeId: string,
  path: string[] = [],
  entries = new Map<string, CompiledFieldDefinition>(),
): Map<string, CompiledFieldDefinition> {
  for (const [fieldName, value] of Object.entries(tree)) {
    if (isDefinitionField(value)) {
      const predicateId = edgeId(value);
      const existing = entries.get(predicateId);
      if (existing) {
        entries.set(predicateId, {
          ...existing,
          ownerTypeIds: new Set([...existing.ownerTypeIds, ownerTypeId]),
        });
        continue;
      }

      entries.set(predicateId, {
        field: value,
        fieldLabel: getFieldLabel(value),
        ownerTypeIds: new Set([ownerTypeId]),
        pathLabel: [...path, fieldName].join("."),
        policy: resolveCompiledFieldPolicy(value),
      });
      continue;
    }

    if (!value || typeof value !== "object") continue;
    flattenCompiledFieldDefinitions(
      value as Record<string, unknown>,
      ownerTypeId,
      [...path, fieldName],
      entries,
    );
  }

  return entries;
}

function buildCompiledFieldIndex(
  graph: WebAppAuthorityGraph,
): ReadonlyMap<string, CompiledFieldDefinition> {
  const entries = new Map<string, CompiledFieldDefinition>();

  for (const typeDef of Object.values(graph)) {
    if (!isEntityType(typeDef)) continue;
    const typeValues = typeDef.values as { readonly key: string; readonly id?: string };
    flattenCompiledFieldDefinitions(typeDef.fields, typeValues.id ?? typeValues.key, [], entries);
  }

  return entries;
}

export function createAuthorizationTarget(
  compiledFieldIndex: ReadonlyMap<string, CompiledFieldDefinition>,
  subjectId: string,
  predicateId: string,
): AuthorizationDecisionTarget {
  return {
    subjectId,
    predicateId,
    policy: compiledFieldIndex.get(predicateId)?.policy,
  };
}

export function getCompiledGraphArtifacts(graph: WebAppAuthorityGraph): CompiledGraphArtifacts {
  const cached = compiledGraphArtifactsCache.get(graph);
  if (cached) return cached;

  const bootstrappedStore = createStore();
  bootstrap(bootstrappedStore, graph);
  const compiled = {
    bootstrappedSnapshot: bootstrappedStore.snapshot(),
    compiledFieldIndex: buildCompiledFieldIndex(graph),
    scalarByKey: collectScalarCodecs(graph),
    typeByKey: collectTypeIndex(graph),
  };

  compiledGraphArtifactsCache.set(graph, compiled);
  return compiled;
}
