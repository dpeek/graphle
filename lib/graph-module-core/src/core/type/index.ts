import { defineType } from "@io/graph-module";

import { iconReferenceField } from "../icon/index.js";
import { node } from "../node/index.js";

export const coreType = defineType({
  values: { key: "core:type", name: "Type" },
  fields: {
    ...node.fields,
    icon: iconReferenceField(),
  },
});
