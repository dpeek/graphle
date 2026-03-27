import type { TypeModuleFilter } from "@io/graph-module";
import type { TypeModuleMeta } from "@io/graph-module";
import { defineScalar } from "@io/graph-module";
import { defineScalarModule } from "@io/graph-module";

import { graphIconSeeds } from "../icon/seed.js";
import { expectStringInput } from "./input.js";

export const stringFilter = {
  defaultOperator: "contains",
  operators: {
    contains: {
      label: "Contains",
      operand: {
        kind: "string",
      },
      parse: (raw: string) => raw,
      format: (operand: string) => operand,
      test: (value: string, operand: string) => value.includes(operand),
    },
    equals: {
      label: "Equals",
      operand: {
        kind: "string",
      },
      parse: (raw: string) => raw,
      format: (operand: string) => operand,
      test: (value: string, operand: string) => value === operand,
    },
    prefix: {
      label: "Starts with",
      operand: {
        kind: "string",
      },
      parse: (raw: string) => raw,
      format: (operand: string) => operand,
      test: (value: string, operand: string) => value.startsWith(operand),
    },
  },
} satisfies TypeModuleFilter<string>;

export const stringMeta = {
  searchable: true,
  summary: {
    kind: "value",
    format: (value: string) => value,
  },
  display: {
    kind: "text",
    allowed: ["text"] as const,
    format: (value: string) => value,
  },
  editor: {
    kind: "text",
    allowed: ["text", "textarea"] as const,
    placeholder: "Enter text",
  },
} satisfies TypeModuleMeta<string, readonly ["text"], readonly ["text", "textarea"]>;

export const stringType = defineScalar({
  values: { key: "core:string", name: "String", icon: graphIconSeeds.string },
  encode: (value: string) => expectStringInput(value),
  decode: (raw) => raw,
});

export const stringTypeModule = defineScalarModule({
  type: stringType,
  meta: stringMeta,
  filter: stringFilter,
});
