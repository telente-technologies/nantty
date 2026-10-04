import { describe, expect, it } from "vitest";

import { hardMaximumCombinedBoost, hardMaximumTierBoost } from "../../src/constants/ranking.constant.js";
import { rankCandidatesDeterministically } from "../../src/integrations/deterministicFeedRanker.integration.js";
import type { RankingCandidate } from "../../src/interfaces/feedRanker.interface.js";
import { assessEngagementIntegrity, cleanIntegritySignals } from "../../src/utils/engagementIntegrity.util.js";
import { calculateCappedAuthorBoost, clampBoostPolicyToHardCaps } from "../../src/utils/rankingBoostPolicy.util.js";

const now = new Date("2026-10-04T12:00:00Z");

function candidate(postId: string, overrides: Partial<RankingCandidate> = {}): RankingCandidate {
  return { postId, authorId: `author_${postId}`, createdAt: new Date("2026-10-04T10:00:00Z"), likeCount: 10, commentCount: 1, repostCount: 0, shareCount: 0, viewCount: 1000, followedAuthor: false, ...overrides };
}

const greedyPolicy = { version: 9, tierBoosts: { none: 1, blue_essential: 9, blue_verified: 9, premium: 9, gold_business: 9, black_official: 9 }, officialEditorialBoost: 9 };

describe("capped, disclosed boosts", () => {
  it("clamps admin weights to hard caps and keeps the tier order", () => {
    const policy = clampBoostPolicyToHardCaps({ version: 1, tierBoosts: { none: 3, blue_essential: 1.04, blue_verified: 1.01, premium: 1.09, gold_business: 1.0, black_official: 4 }, officialEditorialBoost: 2 });
    expect(policy.tierBoosts.none).toBe(1);
    expect(policy.tierBoosts.blue_verified).toBeGreaterThanOrEqual(policy.tierBoosts.blue_essential);
    expect(policy.tierBoosts.gold_business).toBeGreaterThanOrEqual(policy.tierBoosts.premium);
    expect(policy.tierBoosts.black_official).toBe(hardMaximumTierBoost.black_official);
    expect(calculateCappedAuthorBoost("black_official", true, policy)).toBe(hardMaximumCombinedBoost);
  });

  it("lets a free post with much better engagement outrank a maximally boosted weak post", () => {
    const ranked = rankCandidatesDeterministically(
      [candidate("boosted_weak", { authorTier: "black_official", authorIsOfficial: true }), candidate("free_strong", { likeCount: 120, commentCount: 30, shareCount: 20 })],
      { viewerId: null, personalized: false, now, boostPolicy: greedyPolicy },
    );
    expect(ranked.map((item) => item.postId)).toEqual(["free_strong", "boosted_weak"]);
    expect(ranked[1]?.boostMultiplier).toBeLessThanOrEqual(hardMaximumCombinedBoost);
    expect(ranked[1]?.explanations?.at(-1)).toMatchObject({ code: "official_boost", label: "Official account" });
  });

  it("uses the disclosed boost only to separate otherwise equal posts", () => {
    const ranked = rankCandidatesDeterministically([candidate("free_equal"), candidate("gold_equal", { authorTier: "gold_business" })], { viewerId: null, personalized: false, now });
    expect(ranked[0]?.postId).toBe("gold_equal");
    expect(ranked[1]?.boostMultiplier).toBe(1);
    expect(ranked[1]?.explanations?.some((explanation) => explanation.code === "checkmark_boost")).toBe(false);
  });
});

describe("anti-manipulation discounting", () => {
  it("discounts coordinated, new-account and pod engagement and flags it", () => {
    expect(assessEngagementIntegrity({ ...cleanIntegritySignals, engagerCount: 200 }).trustedEngagementShare).toBe(1);
    const ring = assessEngagementIntegrity({ ...cleanIntegritySignals, engagerCount: 200, newAccountEngagerShare: 0.6, burstRatio: 0.9 });
    expect(ring.manipulated).toBe(true);
    expect(ring.reasons).toEqual(expect.arrayContaining(["new_account_engagement", "engagement_burst"]));
    expect(assessEngagementIntegrity({ ...cleanIntegritySignals, engagerCount: 40, reciprocalPodShare: 0.9 }).manipulated).toBe(true);
    expect(assessEngagementIntegrity({ ...cleanIntegritySignals, engagerCount: 3, suspendedEngagerShare: 1 }).manipulated).toBe(false);
  });

  it("ranks honest engagement above a larger manipulated count", () => {
    const ranked = rankCandidatesDeterministically(
      [
        candidate("ring", { likeCount: 300, integrity: { ...cleanIntegritySignals, engagerCount: 300, newAccountEngagerShare: 0.7, suspendedEngagerShare: 0.2 } }),
        candidate("honest", { likeCount: 120, integrity: { ...cleanIntegritySignals, engagerCount: 120 } }),
      ],
      { viewerId: null, personalized: false, now },
    );
    expect(ranked.map((item) => item.postId)).toEqual(["honest", "ring"]);
    expect(ranked.find((item) => item.postId === "ring")?.manipulated).toBe(true);
  });
});

describe("explanations and diversity", () => {
  it("explains following, trending and promoted placements", () => {
    const [item] = rankCandidatesDeterministically([candidate("p", { followedAuthor: true, isPromoted: true, hashtags: ["afrobeats"] })], { viewerId: "v", personalized: true, now, trendingHashtags: ["afrobeats"] });
    expect(item?.explanations?.map((explanation) => explanation.code)).toEqual(["promoted", "following", "trending_topic"]);
  });

  it("never places the same author twice in a row when others are available", () => {
    const flood = Array.from({ length: 6 }, (_, index) => candidate(`flood_${index}`, { authorId: "one_author", likeCount: 500 - index }));
    const others = Array.from({ length: 4 }, (_, index) => candidate(`other_${index}`, { likeCount: 5 }));
    const ranked = rankCandidatesDeterministically([...flood, ...others], { viewerId: null, personalized: false, now });
    const authors = ranked.map((item) => item.authorId);
    for (let index = 1; index < 8; index += 1) expect(authors[index] === "one_author" && authors[index - 1] === "one_author").toBe(false);
    expect(authors.slice(0, 7).filter((author) => author === "one_author").length).toBeLessThanOrEqual(3);
  });
});
