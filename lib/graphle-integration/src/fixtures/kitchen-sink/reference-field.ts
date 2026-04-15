import type { Cardinality, RangeRef } from "@dpeek/graphle-module";
import {
  existingEntityReferenceField,
  type EntityReferenceEditorKind,
} from "@dpeek/graphle-module";

export function kitchenSinkReferenceField<
  const Range extends RangeRef,
  const Card extends Cardinality,
>(
  range: Range,
  input: {
    cardinality: Card;
    collection?: "ordered" | "unordered";
    create?: boolean;
    editorKind?: EntityReferenceEditorKind;
    label?: string;
  },
) {
  return existingEntityReferenceField<Range, Card>(range, input);
}
