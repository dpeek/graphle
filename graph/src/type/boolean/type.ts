import { defineScalar } from "../../graph/schema.js";

export const booleanType = defineScalar({
  values: { key: "core:boolean", name: "Boolean" },
  encode: (value: boolean) => String(value),
  decode: (raw) => raw === "true",
});
