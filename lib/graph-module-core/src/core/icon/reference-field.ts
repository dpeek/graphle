import { entityReferenceComboboxEditorKind, existingEntityReferenceField } from "@io/graph-module";

import { icon } from "./type.js";

export function iconReferenceField(label = "Icon") {
  return existingEntityReferenceField(icon, {
    cardinality: "one?",
    editorKind: entityReferenceComboboxEditorKind,
    label,
  });
}
