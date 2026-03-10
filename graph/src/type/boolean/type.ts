import { defineScalar } from "../../graph/schema.js";
import { expectBooleanInput } from "../input.js";

export const booleanType = defineScalar({
  values: { key: "core:boolean", name: "Boolean" },
  encode: (value: boolean) => String(expectBooleanInput(value)),
  decode: (raw) => {
    if (raw === "true") return true;
    if (raw === "false") return false;
    throw new Error(`Invalid boolean value "${raw}"`);
  },
});
