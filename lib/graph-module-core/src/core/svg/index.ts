import { defineScalarModule } from "@io/graph-module";

import { stringFilter } from "../string/filter.js";
import { svgMeta } from "./meta.js";
import { svgType } from "./type.js";

export const svgTypeModule = defineScalarModule({
  type: svgType,
  meta: svgMeta,
  filter: stringFilter,
});

export { svgMeta, svgType };
