import { amountInMajorUnits, formatMoneyForDisplay } from "../formatMoney.util";

describe("currency minor-unit formatting", () => {
  const cases: ReadonlyArray<readonly [number, string, number]> = [
    [1_250, "JPY", 1_250],
    [125_000, "NGN", 1_250],
    [1_250, "BHD", 1.25],
  ];

  it.each(cases)("converts %s %s minor units using currency metadata", (amountMinor, currency, expected) => {
    expect(amountInMajorUnits(amountMinor, currency)).toBe(expected);
  });

  it("formats zero-decimal currencies without inventing fractional units", () => {
    expect(formatMoneyForDisplay({ amountMinor: 1_250, currency: "JPY" as never })).not.toMatch(/[.,]00\b/);
  });
});
