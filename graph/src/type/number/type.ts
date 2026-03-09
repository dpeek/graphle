import { defineScalar } from "../../graph/schema.js";

export const numberType = defineScalar({
  values: { key: "core:number", name: "Number" },
  encode: (value: number) => String(value),
  decode: (raw) => Number(raw),
});
