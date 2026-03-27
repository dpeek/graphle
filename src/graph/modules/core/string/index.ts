import { defineScalarModule } from "@io/graph-module";

import { stringFilter } from "./filter.js";
import { stringMeta } from "./meta.js";
import { stringType } from "./type.js";

export const stringTypeModule = defineScalarModule({
  type: stringType,
  meta: stringMeta,
  filter: stringFilter,
});

export { stringFilter, stringMeta, stringType };
