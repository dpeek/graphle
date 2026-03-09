import type { TypeModuleFilter } from "../../graph/type-module.js";

export const numberFilter = {
  defaultOperator: "equals",
  operators: {
    equals: {
      label: "Equals",
      parse: (raw: string) => Number(raw),
      format: (operand: number) => String(operand),
      test: (value: number, operand: number) => value === operand,
    },
    lt: {
      label: "Less than",
      parse: (raw: string) => Number(raw),
      format: (operand: number) => String(operand),
      test: (value: number, operand: number) => value < operand,
    },
    gt: {
      label: "Greater than",
      parse: (raw: string) => Number(raw),
      format: (operand: number) => String(operand),
      test: (value: number, operand: number) => value > operand,
    },
  },
} satisfies TypeModuleFilter<number>;
