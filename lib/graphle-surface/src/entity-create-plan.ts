import {
  edgeId,
  fieldWritePolicy,
  isEnumType,
  isFieldsOutput,
  type AnyTypeOutput,
  type EdgeOutput,
} from "@dpeek/graphle-kernel";
import { core } from "@dpeek/graphle-module-core";
import { setDraftValue } from "@dpeek/graphle-react";

const defaultManagedPredicateIds = new Set([
  edgeId(core.node.fields.type),
  edgeId(core.node.fields.createdAt),
  edgeId(core.node.fields.updatedAt),
]);

export type EntityDraftFieldDefinition = {
  readonly field: EdgeOutput;
  readonly fieldName: string;
  readonly path: readonly string[];
  readonly pathLabel: string;
  readonly predicateId: string;
};

export type EntityCreatePlan = {
  readonly clientFields: readonly EntityDraftFieldDefinition[];
  readonly supported: boolean;
};

export type BuildEntityCreatePlanOptions = {
  readonly managedPredicateIds?: ReadonlySet<string>;
};

export function isEntityCreateEdgeOutput(value: unknown): value is EdgeOutput {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EdgeOutput>;
  return (
    typeof candidate.key === "string" &&
    typeof candidate.range === "string" &&
    typeof candidate.cardinality === "string"
  );
}

export function collectEntityDraftFields(
  node: Record<string, unknown>,
  path: string[] = [],
  out: EntityDraftFieldDefinition[] = [],
): EntityDraftFieldDefinition[] {
  for (const [fieldName, value] of Object.entries(node)) {
    if (isEntityCreateEdgeOutput(value)) {
      out.push({
        field: value,
        fieldName,
        path: Object.freeze([...path]),
        pathLabel: [...path, fieldName].join("."),
        predicateId: edgeId(value),
      });
      continue;
    }

    if (!isFieldsOutput(value)) continue;
    collectEntityDraftFields(value as Record<string, unknown>, [...path, fieldName], out);
  }

  return out;
}

export function buildEntityCreatePlan(
  fieldTree: Record<string, unknown>,
  options: BuildEntityCreatePlanOptions = {},
): EntityCreatePlan {
  const managedPredicateIds = options.managedPredicateIds ?? defaultManagedPredicateIds;
  const clientFields: EntityDraftFieldDefinition[] = [];
  let supported = true;

  for (const field of collectEntityDraftFields(fieldTree)) {
    if (managedPredicateIds.has(field.predicateId)) {
      continue;
    }

    const writePolicy = fieldWritePolicy(field.field as Parameters<typeof fieldWritePolicy>[0]);
    if (writePolicy !== "client-tx") {
      if (field.field.cardinality === "one") {
        supported = false;
      }
      continue;
    }

    clientFields.push(field);
  }

  return {
    clientFields,
    supported,
  };
}

export function buildEntityCreateDefaults(
  fieldTree: Record<string, unknown>,
  typeById: ReadonlyMap<string, AnyTypeOutput>,
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  for (const field of collectEntityDraftFields(fieldTree)) {
    if (fieldWritePolicy(field.field as Parameters<typeof fieldWritePolicy>[0]) !== "client-tx") {
      continue;
    }
    if (field.field.cardinality !== "one") continue;

    const rangeType = typeById.get(field.field.range);
    if (!rangeType || !isEnumType(rangeType)) continue;
    const firstOption = Object.values(rangeType.options)[0];
    if (!firstOption) continue;
    const optionId = firstOption.id ?? firstOption.key;
    Object.assign(defaults, setDraftValue(defaults, field.path, field.fieldName, optionId));
  }

  return defaults;
}
