import {
  edgeId,
  fieldWritePolicy,
  isEnumType,
  isFieldsOutput,
  type AnyTypeOutput,
  type EdgeOutput,
} from "@io/core/graph";

import { setDraftValue } from "./create-draft-values.js";
import { createdAtPredicateId, typePredicateId, updatedAtPredicateId } from "./model.js";
import type { EntityCatalogEntry } from "./model.js";

const defaultTagColors = [
  "#2563eb",
  "#0f766e",
  "#d97706",
  "#be123c",
  "#7c3aed",
  "#0891b2",
] as const;

export type DraftFieldDefinition = {
  field: EdgeOutput;
  fieldName: string;
  path: string[];
  pathLabel: string;
  predicateId: string;
  reason?: string;
};

export type CreatePlan = {
  clientFields: DraftFieldDefinition[];
  deferredFields: DraftFieldDefinition[];
  requiredBlockingFields: DraftFieldDefinition[];
  supported: boolean;
};

export function isEdgeOutputValue(value: unknown): value is EdgeOutput {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EdgeOutput>;
  return (
    typeof candidate.key === "string" &&
    typeof candidate.range === "string" &&
    typeof candidate.cardinality === "string"
  );
}

function describeDeferredFieldReason(field: DraftFieldDefinition): string {
  if (field.predicateId === typePredicateId) return "Assigned automatically by the graph.";
  if (field.predicateId === createdAtPredicateId || field.predicateId === updatedAtPredicateId) {
    return "Managed by lifecycle hooks after create.";
  }

  const writePolicy = fieldWritePolicy(field.field as Parameters<typeof fieldWritePolicy>[0]);
  if (writePolicy === "server-command") {
    return "Edited after create through a server-command flow.";
  }
  if (writePolicy === "authority-only") {
    return "Authority-owned and not editable from this client.";
  }
  return "Edited after create through the normal entity view.";
}

function collectDraftFields(
  node: Record<string, unknown>,
  path: string[] = [],
  out: DraftFieldDefinition[] = [],
): DraftFieldDefinition[] {
  for (const [fieldName, value] of Object.entries(node)) {
    if (isEdgeOutputValue(value)) {
      out.push({
        field: value,
        fieldName,
        path,
        pathLabel: [...path, fieldName].join("."),
        predicateId: edgeId(value),
      });
      continue;
    }

    if (!isFieldsOutput(value)) continue;
    collectDraftFields(value as Record<string, unknown>, [...path, fieldName], out);
  }

  return out;
}

export function buildCreatePlan(entry: EntityCatalogEntry): CreatePlan {
  const clientFields: DraftFieldDefinition[] = [];
  const deferredFields: DraftFieldDefinition[] = [];
  const requiredBlockingFields: DraftFieldDefinition[] = [];

  for (const field of collectDraftFields(entry.typeDef.fields as Record<string, unknown>)) {
    const isManagedField =
      field.predicateId === typePredicateId ||
      field.predicateId === createdAtPredicateId ||
      field.predicateId === updatedAtPredicateId;
    const writePolicy = fieldWritePolicy(field.field as Parameters<typeof fieldWritePolicy>[0]);

    if (isManagedField || writePolicy !== "client-tx") {
      const deferred = {
        ...field,
        reason: describeDeferredFieldReason(field),
      };
      deferredFields.push(deferred);
      if (field.field.cardinality === "one" && !isManagedField) {
        requiredBlockingFields.push(deferred);
      }
      continue;
    }

    clientFields.push(field);
  }

  return {
    clientFields,
    deferredFields,
    requiredBlockingFields,
    supported: requiredBlockingFields.length === 0,
  };
}

export function buildCreateDefaults(
  entry: EntityCatalogEntry,
  typeById: ReadonlyMap<string, AnyTypeOutput>,
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  for (const field of collectDraftFields(entry.typeDef.fields as Record<string, unknown>)) {
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

  if (entry.key === "pkm:documentBlock" || entry.key === "pkm:documentPlacement") {
    return setDraftValue(defaults, [], "order", entry.count);
  }

  if (entry.key === "core:tag") {
    return setDraftValue(
      defaults,
      [],
      "color",
      defaultTagColors[entry.count % defaultTagColors.length] ?? defaultTagColors[0],
    );
  }

  return defaults;
}

export function getDeferredFieldReason(field: DraftFieldDefinition): string {
  return field.reason ?? describeDeferredFieldReason(field);
}
