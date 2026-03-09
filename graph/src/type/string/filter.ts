import type { TypeModuleFilter } from "../../graph/type-module.js";

export const stringFilter = {
  defaultOperator: "contains",
  operators: {
    contains: {
      label: "Contains",
      parse: (raw: string) => raw,
      format: (operand: string) => operand,
      test: (value: string, operand: string) => value.includes(operand),
    },
    equals: {
      label: "Equals",
      parse: (raw: string) => raw,
      format: (operand: string) => operand,
      test: (value: string, operand: string) => value === operand,
    },
    prefix: {
      label: "Starts with",
      parse: (raw: string) => raw,
      format: (operand: string) => operand,
      test: (value: string, operand: string) => value.startsWith(operand),
    },
  },
} satisfies TypeModuleFilter<string>;
