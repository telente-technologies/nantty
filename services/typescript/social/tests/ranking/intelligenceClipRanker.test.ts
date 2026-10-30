import { describe, expect, it, vi } from "vitest";

import { deterministicClipRanker, rankClipsDeterministically } from "../../src/integrations/deterministicClipRanker.integration.js";
import { buildIntelligenceClipRequest, createIntelligenceClipRanker } from "../../src/integrations/intelligenceClipRanker.integration.js";
import type { RankingCandidate } from "../../src/interfaces/feedRanker.interface.js";
import { createIdentifierHasher, deriveIdentifierHashSecret } from "../../src/utils/identifierHashing.util.js";

const now = new Date("2026-10-04T12:00:00Z");
const base = { createdAt: now, likeCount: 0, commentCount: 0, repostCount: 1, shareCount: 2, viewCount: 100, followedAuthor: false, durationMs: 15_000 };
const candidates: RankingCandidate[] = [
  { ...base, postId: "clip_a", authorId: "author_a", likeCount: 40, videoViews: 100, completedViews: 5, topics: ["Comedy", "bad topic!"], hashtags: ["afrobeats"] },
  { ...base, postId: "clip_b", authorId: "author_b", videoViews: 100, completedViews: 95, followedAuthor: true, authorTier: "gold_business", integrity: { engagerCount: 3, newAccountEngagerShare: 0, lowTrustEngagerShare: 0, suspendedEngagerShare: 0, clusteredEngagerShare: 0, reciprocalPodShare: 0, burstRatio: 0, purchasedEngagementSuspected: false, spamHashtagCount: 0 } },
];
const hasher = createIdentifierHasher(deriveIdentifierHashSecret("hash-secret", "unused"));
const personalizedContext = { viewerId: "viewer", personalized: true, now, viewerCountry: "NG", trendingHashtags: ["Afrobeats"] };

describe("intelligence clip ranker", () => {
  it("builds a /v1/clips/rank request with hashed ids and watch signals", () => {
    const request = buildIntelligenceClipRequest(candidates, personalizedContext, hasher);
    expect(request.viewer).toEqual({ userId: hasher.hashUserId("viewer"), country: "NG", followedAccountIds: [hasher.hashUserId("author_b")] });
    expect(request.personalized).toBe(true);
    expect(request.candidates[0]).toEqual({
      itemId: "clip_a", creatorId: hasher.hashUserId("author_a"), createdAt: now.toISOString(), durationMs: 15_000, topics: ["comedy"], hashtags: ["afrobeats"],
      viewCount: 100, completionCount: 5, likeCount: 40, commentCount: 0, shareCount: 3, saveCount: 0, authorTier: "none", authorIsOfficial: false, isPromoted: false,
    });
    expect(request.candidates[1]).toMatchObject({ authorTier: "gold_business", integrity: { engagerCount: 3 } });
    expect(request.trendingTopics).toEqual(["afrobeats"]);
    expect(JSON.stringify(request)).not.toContain("author_a");
  });

  it("sends a non-personalized request for viewers without consent and for guests", () => {
    for (const context of [{ ...personalizedContext, personalized: false }, { ...personalizedContext, viewerId: null }]) {
      const request = buildIntelligenceClipRequest(candidates, context, hasher);
      expect(request.viewer.userId).toBe("guest");
      expect(request.viewer.followedAccountIds).toEqual([]);
      expect(request.personalized).toBe(false);
    }
  });

  it("uses the Python order, explanations and boost when it answers", async () => {
    const fetchImplementation = vi.fn(async () => new Response(JSON.stringify({ items: [{ itemId: "clip_a", explanations: [{ code: "similar_to_liked", label: "Similar to clips you watched" }], boostMultiplier: 1 }, { itemId: "clip_b", boostMultiplier: 1.08 }], manipulatedItemIds: ["clip_a"] }), { status: 200 }));
    const ranker = createIntelligenceClipRanker({ baseUrl: "http://intelligence", sharedSecret: "secret", timeoutMs: 250, fallback: deterministicClipRanker, hasher, fetchImplementation });
    const ranked = await ranker.rank(candidates, personalizedContext);
    expect(ranked.map((item) => item.postId)).toEqual(["clip_a", "clip_b"]);
    expect(ranked[0]).toMatchObject({ manipulated: true, explanations: [{ code: "similar_to_liked" }] });
    expect(ranked[1]?.boostMultiplier).toBe(1.08);
    const [url, init] = fetchImplementation.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe("/v1/clips/rank");
    expect((init.headers as Record<string, string>)["x-nantty-signature"]).toMatch(/^v1=/);
  });

  it.each([
    ["a timeout", (_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError"))))],
    ["a 5xx", async () => new Response("boom", { status: 503 })],
  ])("falls back to the deterministic clip order on %s", async (_label, implementation) => {
    const onFallback = vi.fn();
    const ranker = createIntelligenceClipRanker({ baseUrl: "http://intelligence", sharedSecret: "secret", timeoutMs: 20, fallback: deterministicClipRanker, hasher, fetchImplementation: vi.fn(implementation), onFallback });
    const ranked = await ranker.rank(candidates, personalizedContext);
    expect(ranked.map((item) => item.postId)).toEqual(["clip_b", "clip_a"]);
    expect(onFallback).toHaveBeenCalledOnce();
  });

  it("opens the circuit after repeated failures", async () => {
    const fetchImplementation = vi.fn(async () => new Response("boom", { status: 500 }));
    const ranker = createIntelligenceClipRanker({ baseUrl: "http://intelligence", sharedSecret: "secret", timeoutMs: 250, fallback: deterministicClipRanker, hasher, fetchImplementation });
    for (let attempt = 0; attempt < 8; attempt += 1) await ranker.rank(candidates, personalizedContext);
    expect(fetchImplementation).toHaveBeenCalledTimes(5);
  });
});

describe("deterministic clip ranker", () => {
  it("puts a well-completed clip ahead of one that only has likes and keeps the capped boost disclosed", () => {
    const ranked = rankClipsDeterministically(candidates, { ...personalizedContext, personalized: false });
    expect(ranked.map((item) => item.postId)).toEqual(["clip_b", "clip_a"]);
    expect(ranked[0]?.boostMultiplier).toBeLessThanOrEqual(1.12);
    expect(ranked[0]?.explanations?.at(-1)?.code).toBe("checkmark_boost");
  });
});

describe("clip ranking contract with the Python service", () => {
  it("matches the Python wire fixture with current Python identifier vectors", async () => {
    const { readFile } = await import("node:fs/promises");
    const fixture = JSON.parse(await readFile(new URL("../../../../python/intelligence/tests/modules/clips/fixtures/social_clip_rank_request.json", import.meta.url), "utf8")) as unknown;
    const integrity = { engagerCount: 3, newAccountEngagerShare: 0, lowTrustEngagerShare: 0, suspendedEngagerShare: 0, clusteredEngagerShare: 0, reciprocalPodShare: 0, burstRatio: 0, purchasedEngagementSuspected: false, spamHashtagCount: 0 };
    const request = buildIntelligenceClipRequest([
      { postId: "0192f0a0-0000-7000-8000-000000000001", authorId: "0192f0a0-0000-7000-8000-0000000000a1", createdAt: now, likeCount: 4, commentCount: 1, repostCount: 0, shareCount: 2, viewCount: 50, followedAuthor: true, saveCount: 1, hashtags: ["dance"], topics: ["music"], authorTier: "blue_verified", authorIsOfficial: false, authorCountry: "NG", durationMs: 15000, videoViews: 40, completedViews: 30, integrity },
      { postId: "0192f0a0-0000-7000-8000-000000000002", authorId: "0192f0a0-0000-7000-8000-0000000000a2", createdAt: now, likeCount: 0, commentCount: 0, repostCount: 0, shareCount: 0, viewCount: 0, followedAuthor: false },
    ], { viewerId: "0192f0a0-0000-7000-8000-0000000000ff", personalized: true, now, viewerCountry: "NG", trendingHashtags: ["dance"] }, createIdentifierHasher(deriveIdentifierHashSecret("", "k")));
    // The shared wire fixture predates the hash-label rename. These replacements
    // were generated with Python's current identifier_hashing_service, not TS.
    const currentPythonVectors = [
      ["u_8470320fa1e83f584643816b8e559cf79feb4ed7", "u_64e3aa2de555e50b5a6818eea9af0ee46404afcf"],
      ["u_25689497f204c483b2689e018dafc84caecce458", "u_1ca13357c4ce393f8c9147bd4c2f3fd775668fec"],
      ["u_0548275218bad868a05f0b37091448dc6a061f50", "u_26500eed25895d990d517247b8b6dc2080326cd6"],
    ] as const;
    const expected = currentPythonVectors.reduce((json, [previous, current]) => json.replaceAll(previous, current), JSON.stringify(fixture));
    expect(JSON.parse(JSON.stringify(request))).toEqual(JSON.parse(expected));
  });
});
