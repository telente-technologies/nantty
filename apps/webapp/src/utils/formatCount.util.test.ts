import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatCompactCount, formatTaggedPeopleSummary } from "./formatCount.util";

describe("formatCompactCount", () => {
  const cases: readonly (readonly [number, string])[] = [
    [0, "0"],
    [999, "999"],
    [1000, "1K"],
    [1234, "1.2K"],
    [12_345, "12.3K"],
    [99_999, "99.9K"],
    [100_000, "100K"],
    [123_456, "123K"],
    [999_999, "999K"],
    [1_250_000, "1.2M"],
    [123_400_000, "123M"],
    [2_500_000_000, "2.5B"],
  ];
  for (const [input, expected] of cases) it(`formats ${input} as ${expected}`, () => assert.equal(formatCompactCount(input), expected));

  it("guards negatives and NaN", () => {
    assert.equal(formatCompactCount(-1), "0");
    assert.equal(formatCompactCount(Number.NaN), "0");
  });

  it("stays within five characters", () => {
    for (let n = 1; n < 2_000_000_000; n = Math.ceil(n * 1.37)) assert.ok(formatCompactCount(n).length <= 5);
  });
});

describe("formatTaggedPeopleSummary", () => {
  it("summarises tag counts", () => {
    assert.equal(formatTaggedPeopleSummary("Ada", 1), "Ada");
    assert.equal(formatTaggedPeopleSummary("Ada", 2), "Ada and 1 other");
    assert.equal(formatTaggedPeopleSummary("Ada", 4), "Ada and 3 others");
  });
});
