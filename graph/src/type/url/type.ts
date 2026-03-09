import { defineScalar } from "../../graph/schema.js";

export const urlType = defineScalar({
  values: { key: "core:url", name: "URL" },
  encode: (value: URL) => value.toString(),
  decode: (raw) => new URL(raw),
});
