import { defineType } from "../../../graphle-module/src/index.js";

import { iconReferenceField } from "./icon.js";
import { node } from "./node.js";

export const coreType = defineType({
  values: { key: "core:type", name: "Type" },
  fields: {
    ...node.fields,
    icon: iconReferenceField(),
  },
});
