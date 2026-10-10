import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeHostRanking, formatRankChip, isUsableHostRanking, tierForRank } from "./liveHostRank.util";

describe("live host rank", () => {
  it("styles the ring by tier", () => {
    assert.deepEqual([1, 2, 3, 4, 10, 11, 100, 101].map(tierForRank), ["gold", "silver", "bronze", "top10", "top10", "top100", "top100", "ranked"]);
  });

  it("falls back to a plain avatar without a usable rank", () => {
    assert.equal(isUsableHostRanking(null), false);
    assert.equal(isUsableHostRanking(undefined), false);
    assert.equal(isUsableHostRanking({ globalRank: 0, categoryRank: null, category: null, period: "week" }), false);
    assert.equal(isUsableHostRanking({ globalRank: 4, categoryRank: 1, category: "music", period: "week" }), true);
  });

  it("keeps the chip short", () => {
    assert.equal(formatRankChip(12), "#12");
    assert.equal(formatRankChip(5000), "#999+");
  });

  it("puts the category rank inside the global position", () => {
    assert.deepEqual(describeHostRanking({ globalRank: 12, categoryRank: 3, category: "shopping", period: "week" }), {
      globalLine: "#12 globally this week",
      categoryLine: "#3 in Shopping",
      label: "#12 globally this week, #3 in Shopping",
    });
    assert.equal(describeHostRanking({ globalRank: 12, categoryRank: 3, category: "unknown", period: "week" }).categoryLine, null);
  });
});
