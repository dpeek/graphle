import { defineEnumModule } from "../../graph/type-module.js";
import { statusFilter } from "./filter.js";
import { statusMeta } from "./meta.js";
import { statusType } from "./type.js";

export const statusTypeModule = defineEnumModule({
  type: statusType,
  meta: statusMeta,
  filter: statusFilter,
});

export { statusFilter, statusMeta, statusType };
