import { defineScalar } from "@io/graph-module";

import { graphIconSeeds } from "../icon/seed.js";
import { expectRecordInput } from "../input.js";
import {
  compareStructuredValueValues,
  formatStructuredValue,
  formatStructuredValueLiteral,
  normalizeStructuredValueKind,
  normalizeStructuredValueValue,
  parseStructuredValuePart,
  splitTopLevel,
  type StructuredValueByKind,
  type StructuredValueKind,
} from "../structured-value.js";

export type RangeValue<K extends StructuredValueKind = StructuredValueKind> = Readonly<{
  kind: K;
  min: StructuredValueByKind[K];
  max: StructuredValueByKind[K];
}>;

function validateRangeBounds<K extends StructuredValueKind>(
  kind: K,
  min: StructuredValueByKind[K],
  max: StructuredValueByKind[K],
): void {
  if (compareStructuredValueValues(kind, min, max) > 0) {
    throw new Error("Range minimum must be less than or equal to the maximum.");
  }
}

export function normalizeRangeInput(value: unknown): RangeValue {
  const input = expectRecordInput(value);
  const kind = normalizeStructuredValueKind(input.kind);
  const min = normalizeStructuredValueValue(kind, input.min);
  const max = normalizeStructuredValueValue(kind, input.max);
  validateRangeBounds(kind, min, max);

  return {
    kind,
    min,
    max,
  };
}

export function parseRange(raw: string): RangeValue {
  try {
    const [minRaw, maxRaw] = splitTopLevel(raw, "..");
    const min = parseStructuredValuePart(minRaw);
    const max = parseStructuredValuePart(maxRaw);
    if (min.kind !== max.kind) {
      throw new Error("Range endpoints must use the same structured value kind.");
    }
    validateRangeBounds(min.kind, min.value as never, max.value as never);

    return {
      kind: min.kind,
      min: min.value as never,
      max: max.value as never,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("Range minimum") ||
        error.message.startsWith("Range endpoints") ||
        error.message.endsWith("must share the same currency.") ||
        error.message.endsWith("must share the same unit."))
    ) {
      throw error;
    }
    throw new Error(`Invalid range value "${raw}"`);
  }
}

export function decodeRange(raw: string): RangeValue {
  return normalizeRangeInput(JSON.parse(raw) as unknown);
}

export function formatRange(value: RangeValue): string {
  return `${formatStructuredValue(value.kind, value.min as never)} .. ${formatStructuredValue(
    value.kind,
    value.max as never,
  )}`;
}

export function formatRangeEditorValue(value: RangeValue): string {
  return `${formatStructuredValueLiteral(value.kind, value.min as never)} .. ${formatStructuredValueLiteral(
    value.kind,
    value.max as never,
  )}`;
}

export const rangeType = defineScalar({
  values: { key: "core:range", name: "Range", icon: graphIconSeeds.number },
  encode: (value: RangeValue) => JSON.stringify(normalizeRangeInput(value)),
  decode: (raw) => decodeRange(raw),
  validate: ({ value }) => {
    try {
      normalizeRangeInput(value);
    } catch (error) {
      return {
        code: "range.invalid",
        message: error instanceof Error ? error.message : "Range values are invalid.",
      };
    }

    return undefined;
  },
});
