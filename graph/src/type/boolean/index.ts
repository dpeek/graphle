import { defineScalarModule } from "../../graph/type-module.js";
import { booleanFilter } from "./filter.js";
import { booleanMeta } from "./meta.js";
import { booleanType } from "./type.js";

export const booleanTypeModule = defineScalarModule({
  type: booleanType,
  meta: booleanMeta,
  filter: booleanFilter,
});

export { booleanFilter, booleanMeta, booleanType };
