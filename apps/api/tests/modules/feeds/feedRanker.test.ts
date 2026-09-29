import { describe, expect, it } from "vitest";

import {
  calculateRecencyDecay,
  rankFeedPosts,
  scoreFeedPost,
  type FeedRankingContext,
  type RankablePost,
} from "../../../src/modules/feeds/ranking/feedRanker.ranking.js";

const now = new Date("2026-09-10T12:00:00.000Z");

function createRankablePost(id: string, overrides: Partial<RankablePost> = {}): RankablePost {
  return {
    id,
    authorId: `author-${id}`,
    storeId: null,
    topics: [],
    likeCount: 0,
    commentCount: 0,
    repostCount: 0,
    shareCount: 0,
    viewCount: 0,
    createdAt: new Date(now.getTime() - 3_600_000),
    ...overrides,
  };
}

function createContext(overrides: Partial<FeedRankingContext> = {}): FeedRankingContext {
  return {
    now,
    followedUserIds: new Set(),
    followedStoreIds: new Set(),
    preferredTopics: new Set(),
    friendLikeCounts: new Map(),
    ...overrides,
  };
}

describe("feed ranking", () => {
  it("halves the recency weight every 24 hours", () => {
    expect(calculateRecencyDecay(now, now)).toBe(1);
    expect(calculateRecencyDecay(new Date(now.getTime() - 24 * 3_600_000), now)).toBeCloseTo(0.5);
    expect(calculateRecencyDecay(new Date(now.getTime() + 60_000), now)).toBe(1);
  });

  it("ranks engaging posts above quiet ones of the same age", () => {
    const quiet = createRankablePost("quiet");
    const popular = createRankablePost("popular", { likeCount: 40, commentCount: 10 });
    expect(rankFeedPosts([quiet, popular], createContext()).map((post) => post.id)).toEqual(["popular", "quiet"]);
  });

  it("boosts followed authors, followed stores, preferred topics and friend likes", () => {
    const context = createContext({
      followedUserIds: new Set(["author-friend"]),
      followedStoreIds: new Set(["store-1"]),
      preferredTopics: new Set(["fashion"]),
      friendLikeCounts: new Map([["liked", 4]]),
    });
    const base = scoreFeedPost(createRankablePost("plain"), context);
    expect(scoreFeedPost(createRankablePost("friend", { authorId: "author-friend" }), context)).toBeGreaterThan(base);
    expect(scoreFeedPost(createRankablePost("store", { storeId: "store-1" }), context)).toBeGreaterThan(base);
    expect(scoreFeedPost(createRankablePost("topic", { topics: ["fashion"] }), context)).toBeGreaterThan(base);
    expect(scoreFeedPost(createRankablePost("liked"), context)).toBeGreaterThan(base);
  });

  it("lets a fresh post beat an old popular one", () => {
    const old = createRankablePost("old", { likeCount: 20, createdAt: new Date(now.getTime() - 7 * 86_400_000) });
    const fresh = createRankablePost("fresh", { createdAt: now });
    expect(rankFeedPosts([old, fresh], createContext())[0]?.id).toBe("fresh");
  });

  it("breaks ties by newest first, then by id, without mutating the input", () => {
    const first = createRankablePost("a");
    const second = createRankablePost("b");
    const input = [first, second];
    expect(rankFeedPosts(input, createContext()).map((post) => post.id)).toEqual(["b", "a"]);
    expect(input.map((post) => post.id)).toEqual(["a", "b"]);
  });
});
