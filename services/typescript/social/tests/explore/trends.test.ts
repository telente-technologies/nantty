import { describe, expect, it } from "vitest";

import { aggregateTrends, type EligibleTrendPost } from "../../src/modules/explore/services/trends.service.js";
import { buildTemplateHeadlines } from "../../src/modules/explore/services/headlines.service.js";
import { buildIntegritySignalsForPost, calculateBurstRatio } from "../../src/modules/feeds/services/engagementIntegritySignals.service.js";

const now = new Date("2026-10-04T12:00:00Z");
let counter = 0;

function post(authorId: string, hashtags: string[], overrides: Partial<EligibleTrendPost> = {}): EligibleTrendPost {
  counter += 1;
  return { id: `post_${counter}`, authorId, text: hashtags.map((tag) => `#${tag}`).join(" "), createdAt: new Date("2026-10-04T10:00:00Z"), likeCount: 10, commentCount: 1, repostCount: 0, shareCount: 0, viewCount: 100, saveCount: 0, hashtags, trustedShare: 1, authorCountry: "NG", ...overrides };
}

const keepAll = { isRemoved: () => false };

describe("trends", () => {
  it("scopes trends per country and category", () => {
    const posts = [
      ...["a", "b", "c"].map((author) => post(author, ["afrobeats"])),
      ...["d", "e", "f"].map((author) => post(author, ["supereagles"])),
      ...["g", "h", "i"].map((author) => post(author, ["blackstars"], { authorCountry: "GH" })),
    ];
    expect(aggregateTrends(posts, now, { ...keepAll, country: "NG", category: null }).map((trend) => trend.hashtag).sort()).toEqual(["afrobeats", "supereagles"]);
    expect(aggregateTrends(posts, now, { ...keepAll, country: "GH", category: null }).map((trend) => trend.hashtag)).toEqual(["blackstars"]);
    expect(aggregateTrends(posts, now, { ...keepAll, country: "NG", category: "sports" }).map((trend) => trend.hashtag)).toEqual(["supereagles"]);
    expect(aggregateTrends(posts, now, { ...keepAll, country: null, category: "music" })[0]).toMatchObject({ hashtag: "afrobeats", categoryLabel: "Music", postCount: 3, authorCount: 3 });
  });

  it("needs several authors, skips spam tags, caps one author's weight and honours removals", () => {
    const flood = Array.from({ length: 30 }, () => post("flooder", ["myshop"], { likeCount: 1000 }));
    const spam = ["a", "b", "c", "d"].map((author) => post(author, ["follow4follow"]));
    const honest = ["a", "b", "c"].map((author) => post(author, ["jollof"]));
    const capped = [...Array.from({ length: 10 }, () => post("loud", ["lagosrain"], { likeCount: 500 })), post("q", ["lagosrain"]), post("r", ["lagosrain"])];
    const trends = aggregateTrends([...flood, ...spam, ...honest, ...capped], now, { ...keepAll, country: null, category: null });
    expect(trends.map((trend) => trend.hashtag)).not.toContain("myshop");
    expect(trends.map((trend) => trend.hashtag)).not.toContain("follow4follow");
    expect(trends.map((trend) => trend.hashtag)).toContain("jollof");
    const removed = aggregateTrends(honest, now, { country: null, category: null, isRemoved: (tag) => tag === "jollof" });
    expect(removed).toEqual([]);
  });

  it("builds neutral template headlines from eligible public posts only", () => {
    const posts = ["a", "b", "c", "d"].map((author) => post(author, ["lagosfashionweek"]));
    const [headline] = buildTemplateHeadlines(posts, now, { country: null, category: null, limit: 5, isRemoved: () => false });
    expect(headline).toMatchObject({ title: "People are posting about #lagosfashionweek", generatedBy: "template_v1", postCount: 4, category: "fashion" });
    expect(headline?.postIds).toHaveLength(4);
  });
});

describe("engagement integrity signals", () => {
  it("measures bursts, new accounts, suspended engagers and reciprocal pods", () => {
    const base = new Date("2026-10-04T11:00:00Z").getTime();
    const likes = Array.from({ length: 25 }, (_, index) => ({ postId: "p", userId: `u${index}`, createdAt: new Date(base + index * 1000) }));
    expect(calculateBurstRatio(likes.map((like) => like.createdAt.getTime()))).toBe(1);
    const signals = buildIntegritySignalsForPost({
      authorId: "author",
      text: "new drop #follow4follow",
      likes: [...likes, { postId: "p", userId: "author", createdAt: new Date(base) }],
      accountCreatedAt: new Map(likes.slice(0, 10).map((like) => [like.userId, new Date("2026-10-03T00:00:00Z")])),
      suspendedAccountIds: new Set(["u0", "u1"]),
      accountsAuthorLiked: new Set(likes.slice(0, 20).map((like) => like.userId)),
      now,
    });
    expect(signals.engagerCount).toBe(25);
    expect(signals.newAccountEngagerShare).toBeCloseTo(0.4);
    expect(signals.suspendedEngagerShare).toBeCloseTo(0.08);
    expect(signals.reciprocalPodShare).toBeCloseTo(0.8);
    expect(signals.spamHashtagCount).toBe(1);
  });
});
