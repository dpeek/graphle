import { defineScalar } from "../graph/schema.js";
import {
  defineScalarModule,
  type TypeModuleFilter,
  type TypeModuleMeta,
} from "../graph/type-module.js";
import { expectDateInput } from "./input.js";

function parseDate(raw: string): Date {
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) {
    throw new Error(`Invalid date value "${raw}"`);
  }
  return value;
}

function formatDate(value: Date): string {
  return expectDateInput(value).toISOString();
}

export const dateType = defineScalar({
  values: { key: "core:date", name: "Date" },
  encode: formatDate,
  decode: parseDate,
});

export const dateMeta = {
  searchable: true,
  summary: {
    kind: "value",
    format: formatDate,
  },
  display: {
    kind: "date",
    allowed: ["date", "text"] as const,
    format: formatDate,
  },
  editor: {
    kind: "date",
    allowed: ["date", "text"] as const,
    placeholder: "2026-03-10T12:00:00.000Z",
  },
} satisfies TypeModuleMeta<Date, readonly ["date", "text"], readonly ["date", "text"]>;

export const dateFilter = {
  defaultOperator: "on",
  operators: {
    on: {
      label: "On",
      operand: {
        kind: "date",
        placeholder: "2026-03-10T12:00:00.000Z",
      },
      parse: parseDate,
      format: formatDate,
      test: (value: Date, operand: Date) => value.getTime() === operand.getTime(),
    },
    before: {
      label: "Before",
      operand: {
        kind: "date",
        placeholder: "2026-03-10T12:00:00.000Z",
      },
      parse: parseDate,
      format: formatDate,
      test: (value: Date, operand: Date) => value.getTime() < operand.getTime(),
    },
    after: {
      label: "After",
      operand: {
        kind: "date",
        placeholder: "2026-03-10T12:00:00.000Z",
      },
      parse: parseDate,
      format: formatDate,
      test: (value: Date, operand: Date) => value.getTime() > operand.getTime(),
    },
  },
} satisfies TypeModuleFilter<Date>;

export const dateTypeModule = defineScalarModule({
  type: dateType,
  meta: dateMeta,
  filter: dateFilter,
});
