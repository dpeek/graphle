import { defineScalar } from "../../graph/schema.js";
import { expectStringInput } from "../input.js";

export const stringType = defineScalar({
  values: { key: "core:string", name: "String" },
  encode: (value: string) => expectStringInput(value),
  decode: (raw) => raw,
});
