import { defineScalar } from "../../graph/schema.js";

export const stringType = defineScalar({
  values: { key: "core:string", name: "String" },
  encode: (value: string) => value,
  decode: (raw) => raw,
});
