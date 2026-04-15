import { describe, expect, it } from "bun:test";

import { currency } from "./currency.js";
import { decodeRange, formatRange, normalizeRangeInput, parseRange } from "./range.js";

describe("range value module", () => {
  it("parses and formats shared-kind structured endpoints", () => {
    const value = parseRange("percent(10%) .. percent(80%)");

    expect(value).toEqual({
      kind: "percent",
      min: 10,
      max: 80,
    });
    expect(formatRange(value)).toBe("10% .. 80%");
  });

  it("normalizes persisted objects and enforces ordered compatible bounds", () => {
    expect(
      decodeRange(
        '{"kind":"money","min":{"amount":12,"currency":"USD"},"max":{"amount":24,"currency":"usd"}}',
      ),
    ).toEqual({
      kind: "money",
      min: { amount: 12, currency: currency.options.usd.key },
      max: { amount: 24, currency: currency.options.usd.key },
    });
    expect(() =>
      normalizeRangeInput({
        kind: "quantity",
        min: { amount: 10, unit: "kg" },
        max: { amount: 5, unit: "kg" },
      }),
    ).toThrow("Range minimum must be less than or equal to the maximum.");
    expect(() =>
      normalizeRangeInput({
        kind: "money",
        min: { amount: 12, currency: "usd" },
        max: { amount: 24, currency: "eur" },
      }),
    ).toThrow("Money values must share the same currency.");
  });
});
