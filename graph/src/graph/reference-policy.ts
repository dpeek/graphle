import type { Cardinality, RangeRef } from "./schema.js";
import type { ReferenceFieldInput } from "./type-module.js";
import { defineReferenceField } from "./type-module.js";

export const entityReferenceListDisplayKind = "entity-reference-list";
export const entityReferenceChecklistEditorKind = "entity-reference-checklist";

export type ExistingEntityReferencePolicy = {
  selection: "existing-only";
  create: false;
};

export type EntityReferenceFieldMeta = {
  label?: string;
  reference: ExistingEntityReferencePolicy;
};

export function existingEntityReferenceFieldMeta(input?: {
  label?: string;
}): EntityReferenceFieldMeta {
  return {
    ...(input?.label ? { label: input.label } : {}),
    reference: {
      selection: "existing-only",
      create: false,
    },
  };
}

type ExistingEntityReferenceFieldInput<Range extends RangeRef, Card extends Cardinality> = Omit<
  ReferenceFieldInput<Range, { meta: EntityReferenceFieldMeta }, Card>,
  "meta" | "range"
> & {
  label?: string;
};

export function existingEntityReferenceField<
  const Range extends RangeRef,
  const Card extends Cardinality,
>(range: Range, input: ExistingEntityReferenceFieldInput<Range, Card>) {
  const { label, ...rest } = input;
  return defineReferenceField({
    ...rest,
    range,
    meta: existingEntityReferenceFieldMeta(label ? { label } : undefined),
  });
}
