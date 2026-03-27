import { defineScalarModule } from "@io/graph-module";

import { booleanFilter } from "./filter.js";
import { booleanMeta } from "./meta.js";
import { booleanType } from "./type.js";

export const booleanTypeModule = defineScalarModule({
  type: booleanType,
  meta: booleanMeta,
  filter: booleanFilter,
});

export { booleanFilter, booleanMeta, booleanType };
