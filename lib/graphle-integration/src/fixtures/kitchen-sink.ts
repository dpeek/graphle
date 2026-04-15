import { applyGraphIdMap, createGraphIdMap } from "@dpeek/graphle-kernel";

import { kitchenSinkEnumSchema } from "./kitchen-sink/enums.js";
import { kitchenSinkScalarSchema } from "./kitchen-sink/scalars.js";
import { kitchenSinkTypeSchema } from "./kitchen-sink/types.js";

export * from "./kitchen-sink/index.js";

export const kitchenSinkSchema = {
  ...kitchenSinkEnumSchema,
  ...kitchenSinkScalarSchema,
  ...kitchenSinkTypeSchema,
} as const;

export const kitchenSinkIdMap = createGraphIdMap(kitchenSinkSchema).map;

export const kitchenSink = applyGraphIdMap(kitchenSinkIdMap, kitchenSinkSchema);
