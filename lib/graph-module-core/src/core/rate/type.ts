import { defineScalar } from "@io/graph-module";

import { graphIconSeeds } from "../icon/seed.js";
import { expectRecordInput } from "../input.js";
import {
  formatStructuredValuePart,
  formatStructuredValuePartLiteral,
  getStructuredValueMagnitude,
  normalizeStructuredValuePart,
  parseStructuredValuePart,
  splitTopLevel,
  type StructuredValuePart,
} from "../structured-value.js";

export type RateValue = Readonly<{
  numerator: StructuredValuePart;
  denominator: StructuredValuePart;
}>;

function validateRateDenominator(value: StructuredValuePart): void {
  if (getStructuredValueMagnitude(value) <= 0) {
    throw new Error("Rate denominators must be greater than zero.");
  }
}

export function normalizeRateInput(value: unknown): RateValue {
  const input = expectRecordInput(value);
  const denominator = normalizeStructuredValuePart(input.denominator);
  validateRateDenominator(denominator);

  return {
    numerator: normalizeStructuredValuePart(input.numerator),
    denominator,
  };
}

export function parseRate(raw: string): RateValue {
  try {
    const [numeratorRaw, denominatorRaw] = splitTopLevel(raw, "/");
    const denominator = parseStructuredValuePart(denominatorRaw);
    validateRateDenominator(denominator);

    return {
      numerator: parseStructuredValuePart(numeratorRaw),
      denominator,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Rate denominators")) {
      throw error;
    }
    throw new Error(`Invalid rate value "${raw}"`);
  }
}

export function decodeRate(raw: string): RateValue {
  return normalizeRateInput(JSON.parse(raw) as unknown);
}

export function formatRate(value: RateValue): string {
  return `${formatStructuredValuePart(value.numerator)} / ${formatStructuredValuePart(value.denominator)}`;
}

export function formatRateEditorValue(value: RateValue): string {
  return `${formatStructuredValuePartLiteral(value.numerator)} / ${formatStructuredValuePartLiteral(
    value.denominator,
  )}`;
}

export const rateType = defineScalar({
  values: { key: "core:rate", name: "Rate", icon: graphIconSeeds.number },
  encode: (value: RateValue) => JSON.stringify(normalizeRateInput(value)),
  decode: (raw) => decodeRate(raw),
  validate: ({ value }) => {
    try {
      normalizeRateInput(value);
    } catch (error) {
      return {
        code: "rate.invalid",
        message: error instanceof Error ? error.message : "Rate values are invalid.",
      };
    }

    return undefined;
  },
});
