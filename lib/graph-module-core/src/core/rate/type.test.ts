import { describe, expect, it } from "bun:test";

import { currency } from "../currency/index.js";
import { decodeRate, formatRate, normalizeRateInput, parseRate } from "./type.js";

describe("rate value module", () => {
  it("parses and formats nested structured values", () => {
    const value = parseRate("money(125 USD) / duration(1 day)");

    expect(value).toEqual({
      numerator: {
        kind: "money",
        value: {
          amount: 125,
          currency: currency.options.usd.key,
        },
      },
      denominator: {
        kind: "duration",
        value: 86_400_000,
      },
    });
    expect(formatRate(value)).toBe("125 USD / 1 day");
  });

  it("normalizes persisted rate objects and rejects zero denominators", () => {
    expect(
      decodeRate(
        '{"numerator":{"kind":"quantity","value":{"amount":24,"unit":"pcs"}},"denominator":{"kind":"duration","value":3600000}}',
      ),
    ).toEqual({
      numerator: {
        kind: "quantity",
        value: { amount: 24, unit: "pcs" },
      },
      denominator: {
        kind: "duration",
        value: 3_600_000,
      },
    });
    expect(() =>
      normalizeRateInput({
        numerator: { kind: "percent", value: 10 },
        denominator: { kind: "quantity", value: { amount: 0, unit: "pkg" } },
      }),
    ).toThrow("Rate denominators must be greater than zero.");
  });
});
