import type { TypeModuleFilter } from "../../graph/type-module.js";

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
      parse: parseBoolean,
      format: (operand: boolean) => String(operand),
      test: (value: boolean, operand: boolean) => value === operand,
    },
    isNot: {
      label: "Is not",
      parse: parseBoolean,
      format: (operand: boolean) => String(operand),
      test: (value: boolean, operand: boolean) => value !== operand,
    },
  },
} satisfies TypeModuleFilter<boolean>;
