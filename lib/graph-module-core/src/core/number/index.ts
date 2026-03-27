import { defineScalarModule } from "@io/graph-module";

import { numberFilter } from "./filter.js";
import { numberMeta } from "./meta.js";
import { numberType } from "./type.js";

export const numberTypeModule = defineScalarModule({
  type: numberType,
  meta: numberMeta,
  filter: numberFilter,
});

export { numberFilter, numberMeta, numberType };
