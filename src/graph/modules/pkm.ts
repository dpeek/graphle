import { defineNamespace } from "../runtime/schema.js";
import ids from "./pkm.json";
import { topicSchema } from "./pkm/topic/schema.js";

export const pkm = defineNamespace(ids, {
  ...topicSchema,
});
