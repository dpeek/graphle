import type { TypeModuleFilter } from "@io/graph-module";
import type { TypeModuleMeta } from "@io/graph-module";
import { defineScalar } from "@io/graph-module";
import { defineScalarModule } from "@io/graph-module";

import { graphIconSeeds } from "./icon.js";

function formatJson(value: unknown): string {
  return JSON.stringify(value);
}

export const jsonFilter = {
  defaultOperator: "contains",
  operators: {
    contains: {
      label: "Contains",
      operand: {
        kind: "string",
      },
      parse: (raw: string) => raw,
      format: (operand: string) => operand,
      test: (value: unknown, operand: string) => formatJson(value).includes(operand),
    },
    equals: {
      label: "Equals",
      operand: {
        kind: "string",
      },
      parse: (raw: string) => raw,
      format: (operand: string) => operand,
      test: (value: unknown, operand: string) => formatJson(value) === operand,
    },
  },
} satisfies TypeModuleFilter<unknown>;

export const jsonMeta = {
  summary: {
    kind: "value",
    format: formatJson,
  },
  display: {
    kind: "text",
    allowed: ["text"] as const,
    format: formatJson,
  },
  editor: {
    kind: "textarea",
    allowed: ["text", "textarea"] as const,
    placeholder: '{"key":"value"}',
    multiline: true,
  },
} satisfies TypeModuleMeta<unknown, readonly ["text"], readonly ["text", "textarea"]>;

export const jsonType = defineScalar<unknown>({
  values: { key: "core:json", name: "JSON", icon: graphIconSeeds.json },
  encode: (value) => JSON.stringify(value),
  decode: (raw) => JSON.parse(raw) as unknown,
});

export const jsonTypeModule = defineScalarModule({
  type: jsonType,
  meta: jsonMeta,
  filter: jsonFilter,
});
