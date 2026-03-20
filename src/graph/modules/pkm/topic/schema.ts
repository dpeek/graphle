export * from "./kind.js";
export * from "./type.js";

import { topicKind } from "./kind.js";
import { topic } from "./type.js";

export const topicSchema = {
  topic,
  topicKind,
} as const;
