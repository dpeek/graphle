import { createIdMap } from "../runtime/identity.js";
import { defineNamespace } from "../runtime/schema.js";
import { kitchenSinkEnumSchema } from "./kitchen-sink/enums.js";
import { kitchenSinkScalarSchema } from "./kitchen-sink/scalars.js";
import { kitchenSinkTypeSchema } from "./kitchen-sink/types.js";

export * from "./kitchen-sink/index.js";

export const kitchenSinkSchema = {
  ...kitchenSinkEnumSchema,
  ...kitchenSinkScalarSchema,
  ...kitchenSinkTypeSchema,
} as const;

export const kitchenSinkIdMap = createIdMap(kitchenSinkSchema).map;

export const kitchenSink = defineNamespace(kitchenSinkIdMap, kitchenSinkSchema);
