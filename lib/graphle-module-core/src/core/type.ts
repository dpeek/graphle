import { defineType } from "@dpeek/graphle-module";

import { iconReferenceField } from "./icon.js";
import { node } from "./node.js";

export const coreType = defineType({
  values: { key: "core:type", name: "Type" },
  fields: {
    ...node.fields,
    icon: iconReferenceField(),
  },
});
