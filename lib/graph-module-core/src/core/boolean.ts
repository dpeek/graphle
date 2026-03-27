import type { TypeModuleFilter } from "@io/graph-module";
import type { TypeModuleMeta } from "@io/graph-module";
import { defineScalar } from "@io/graph-module";
import { defineScalarModule } from "@io/graph-module";

import { graphIconSeeds } from "../icon/seed.js";
import { expectBooleanInput } from "./input.js";

function parseBoolean(raw: string): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`Invalid boolean value "${raw}"`);
}

export const booleanFilter = {
  defaultOperator: "is",
  operators: {
    is: {
      label: "Is",
      operand: {
        kind: "boolean",
      },
      parse: parseBoolean,
      format: (operand: boolean) => String(operand),
      test: (value: boolean, operand: boolean) => value === operand,
    },
    isNot: {
      label: "Is not",
      operand: {
        kind: "boolean",
      },
      parse: parseBoolean,
      format: (operand: boolean) => String(operand),
      test: (value: boolean, operand: boolean) => value !== operand,
    },
  },
} satisfies TypeModuleFilter<boolean>;

export const booleanMeta = {
  summary: {
    kind: "value",
    format: (value: boolean) => (value ? "True" : "False"),
  },
  display: {
    kind: "boolean",
    allowed: ["boolean", "text"] as const,
    format: (value: boolean) => (value ? "True" : "False"),
  },
  editor: {
    kind: "checkbox",
    allowed: ["checkbox", "switch"] as const,
  },
} satisfies TypeModuleMeta<boolean, readonly ["boolean", "text"], readonly ["checkbox", "switch"]>;

export const booleanType = defineScalar({
  values: { key: "core:boolean", name: "Boolean", icon: graphIconSeeds.boolean },
  encode: (value: boolean) => String(expectBooleanInput(value)),
  decode: (raw) => {
    if (raw === "true") return true;
    if (raw === "false") return false;
    throw new Error(`Invalid boolean value "${raw}"`);
  },
});

export const booleanTypeModule = defineScalarModule({
  type: booleanType,
  meta: booleanMeta,
  filter: booleanFilter,
});
