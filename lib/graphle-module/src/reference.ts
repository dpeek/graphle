import type { Cardinality, RangeRef } from "../../graphle-kernel/src/index.js";

import type { ReferenceFieldInput } from "./type.js";
import { defineReferenceField } from "./type.js";

/**
 * Canonical display kind for read-only entity-reference collections.
 */
export const entityReferenceListDisplayKind = "entity-reference-list";

/**
 * Canonical editor kind for entity-reference search and selection.
 */
export const entityReferenceComboboxEditorKind = "entity-reference-combobox";

/**
 * Editor kinds supported by the shared existing-entity reference policy.
 */
export type EntityReferenceEditorKind = typeof entityReferenceComboboxEditorKind;

/**
 * Collection ordering semantics supported by the shared existing-entity
 * reference policy.
 */
export type EntityReferenceCollectionKind = "ordered" | "unordered";

/**
 * Shared policy payload for fields that only permit selecting existing
 * entities.
 */
export type ExistingEntityReferencePolicy = {
  selection: "existing-only";
  create: boolean;
  excludeSubject?: boolean;
};

/**
 * Host-neutral metadata payload attached to existing-entity reference fields.
 */
export type EntityReferenceFieldMeta = {
  label?: string;
  reference: ExistingEntityReferencePolicy;
  editor?: {
    kind: EntityReferenceEditorKind;
  };
  collection?: {
    kind: EntityReferenceCollectionKind;
  };
};

/**
 * Produces the shared authored metadata contract for existing-entity reference
 * fields.
 */
export function existingEntityReferenceFieldMeta(input?: {
  label?: string;
  create?: boolean;
  editorKind?: EntityReferenceEditorKind;
  collection?: EntityReferenceCollectionKind;
  excludeSubject?: boolean;
}): EntityReferenceFieldMeta {
  return {
    ...(input?.label ? { label: input.label } : {}),
    reference: {
      selection: "existing-only",
      create: input?.create ?? false,
      ...(input?.excludeSubject ? { excludeSubject: true } : {}),
    },
    ...(input?.editorKind ? { editor: { kind: input.editorKind } } : {}),
    ...(input?.collection ? { collection: { kind: input.collection } } : {}),
  };
}

type ExistingEntityReferenceFieldInput<Range extends RangeRef, Card extends Cardinality> = Omit<
  ReferenceFieldInput<Range, { meta: EntityReferenceFieldMeta }, Card>,
  "meta" | "range"
> & {
  label?: string;
  create?: boolean;
  editorKind?: EntityReferenceEditorKind;
  collection?: EntityReferenceCollectionKind;
  excludeSubject?: boolean;
};

/**
 * Authors a reference field that only permits selecting existing entities.
 */
export function existingEntityReferenceField<
  const Range extends RangeRef,
  const Card extends Cardinality,
>(range: Range, input: ExistingEntityReferenceFieldInput<Range, Card>) {
  const { collection, create, editorKind, excludeSubject, label, ...rest } = input;
  const field: ReferenceFieldInput<Range, { meta: EntityReferenceFieldMeta }, Card> = {
    ...rest,
    range,
    meta: existingEntityReferenceFieldMeta({
      collection,
      create,
      editorKind,
      excludeSubject,
      label,
    }),
  };
  return defineReferenceField<Range, { meta: EntityReferenceFieldMeta }, Card>(field);
}
