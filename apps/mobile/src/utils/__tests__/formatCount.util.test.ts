import { formatCompactCount, formatTaggedPeopleSummary } from "../formatCount.util";
import { formatCountWithThousandsSuffix } from "../formatDate.util";

describe("formatCompactCount", () => {
  it.each([
    [0, "0"],
    [7, "7"],
    [999, "999"],
    [1000, "1K"],
    [1234, "1.2K"],
    [12_345, "12.3K"],
    [99_999, "99.9K"],
    [100_000, "100K"],
    [123_456, "123K"],
    [999_999, "999K"],
    [1_000_000, "1M"],
    [1_250_000, "1.2M"],
    [123_400_000, "123M"],
    [2_500_000_000, "2.5B"],
  ])("formats %d as %s", (input, expected) => {
    expect(formatCompactCount(input)).toBe(expected);
  });

  it("never returns a decimal at or above 100K", () => {
    for (const n of [100_000, 150_550, 456_789, 999_950, 100_000_000]) expect(formatCompactCount(n)).not.toContain(".");
  });

  it("guards negatives, fractions and NaN", () => {
    expect(formatCompactCount(-5)).toBe("0");
    expect(formatCompactCount(Number.NaN)).toBe("0");
    expect(formatCompactCount(1999.9)).toBe("1.9K");
  });

  it("stays short enough for the clips rail", () => {
    for (let n = 1; n < 2_000_000_000; n = Math.ceil(n * 1.37)) expect(formatCompactCount(n).length).toBeLessThanOrEqual(5);
  });

  it("is the same formatter as the legacy alias", () => {
    expect(formatCountWithThousandsSuffix(123_456)).toBe("123K");
  });
});

describe("formatTaggedPeopleSummary", () => {
  it("names one person on their own", () => {
    expect(formatTaggedPeopleSummary("Ada", 1)).toBe("Ada");
  });
  it("uses the singular for one other", () => {
    expect(formatTaggedPeopleSummary("Ada", 2)).toBe("Ada and 1 other");
  });
  it("compacts large tag counts", () => {
    expect(formatTaggedPeopleSummary("Ada", 1_501)).toBe("Ada and 1.5K others");
  });
});
