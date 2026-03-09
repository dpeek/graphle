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
