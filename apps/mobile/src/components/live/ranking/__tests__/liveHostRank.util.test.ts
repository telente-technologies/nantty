import { describeHostRanking, formatRankChip, isUsableHostRanking, tierForRank } from "../liveHostRank.util";

describe("live host rank", () => {
  it("styles the ring by tier", () => {
    expect([1, 2, 3, 4, 10, 11, 100, 101].map(tierForRank)).toEqual(["gold", "silver", "bronze", "top10", "top10", "top100", "top100", "ranked"]);
  });

  it("shows a plain avatar when the host has no usable rank", () => {
    expect(isUsableHostRanking(null)).toBe(false);
    expect(isUsableHostRanking(undefined)).toBe(false);
    expect(isUsableHostRanking({ globalRank: 0, categoryRank: null, category: null, period: "week" })).toBe(false);
    expect(isUsableHostRanking({ globalRank: Number.NaN, categoryRank: null, category: null, period: "week" })).toBe(false);
    expect(isUsableHostRanking({ globalRank: 12, categoryRank: 3, category: "shopping", period: "week" })).toBe(true);
  });

  it("keeps the chip short", () => {
    expect(formatRankChip(12)).toBe("#12");
    expect(formatRankChip(1000)).toBe("#999+");
  });

  it("puts the category rank inside the global position", () => {
    expect(describeHostRanking({ globalRank: 12, categoryRank: 3, category: "shopping", period: "week" }, "Shopping")).toEqual({
      globalLine: "#12 globally this week",
      categoryLine: "#3 in Shopping",
      accessibilityLabel: "#12 globally this week, #3 in Shopping",
    });
    expect(describeHostRanking({ globalRank: 1500, categoryRank: null, category: null, period: "week" }, null).categoryLine).toBeNull();
  });
});
