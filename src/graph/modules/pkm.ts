import { applyIdMap } from "../runtime/schema.js";
import ids from "./pkm.json";
import { documentSchema } from "./pkm/document/schema.js";

export const pkm = applyIdMap(ids, {
  ...documentSchema,
});
