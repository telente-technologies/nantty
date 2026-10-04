import { describe, expect, it, vi } from "vitest";

import { deterministicFeedRanker } from "../../src/integrations/deterministicFeedRanker.integration.js";
import { buildIntelligenceFeedRequest, createIntelligenceFeedRanker } from "../../src/integrations/intelligenceFeedRanker.integration.js";
import type { RankingCandidate } from "../../src/interfaces/feedRanker.interface.js";

const now = new Date("2026-10-04T12:00:00Z");
const candidates: RankingCandidate[] = [
  { postId: "a", authorId: "author_a", createdAt: now, likeCount: 1, commentCount: 0, repostCount: 0, shareCount: 0, viewCount: 10, followedAuthor: false, hashtags: ["afrobeats", "Ünïcode"] },
  { postId: "b", authorId: "author_b", createdAt: now, likeCount: 50, commentCount: 5, repostCount: 0, shareCount: 0, viewCount: 100, followedAuthor: true },
];
const context = { viewerId: "viewer", personalized: true, now };

describe("intelligence feed ranker", () => {
  it("uses the Python order and explanations when it answers in time", async () => {
    const fetchImplementation = vi.fn(async () => new Response(JSON.stringify({ items: [{ itemId: "a", explanations: [{ code: "trending_topic", label: "Trending: #afrobeats" }], boostMultiplier: 1 }, { itemId: "b" }], manipulatedItemIds: [] }), { status: 200 }));
    const ranker = createIntelligenceFeedRanker({ baseUrl: "http://intelligence", sharedSecret: "secret", timeoutMs: 250, fallback: deterministicFeedRanker, fetchImplementation });
    const ranked = await ranker.rank(candidates, context);
    expect(ranked.map((item) => item.postId)).toEqual(["a", "b"]);
    expect(ranked[0]?.explanations?.[0]?.code).toBe("trending_topic");
    const [, init] = fetchImplementation.mock.calls[0] as unknown as [URL, RequestInit];
    expect((init.headers as Record<string, string>)["x-zudo-signature"]).toMatch(/^v1=/);
  });

  it("falls back to the deterministic order when Python is slower than the timeout", async () => {
    const fetchImplementation = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError")))));
    const onFallback = vi.fn();
    const ranker = createIntelligenceFeedRanker({ baseUrl: "http://intelligence", sharedSecret: "secret", timeoutMs: 20, fallback: deterministicFeedRanker, fetchImplementation, onFallback });
    const ranked = await ranker.rank(candidates, context);
    expect(ranked.map((item) => item.postId)).toEqual((await deterministicFeedRanker.rank(candidates, context)).map((item) => item.postId));
    expect(onFallback).toHaveBeenCalledWith("TimeoutError");
  });

  it("opens the circuit after repeated failures and stops calling Python", async () => {
    const fetchImplementation = vi.fn(async () => new Response("boom", { status: 500 }));
    const ranker = createIntelligenceFeedRanker({ baseUrl: "http://intelligence", sharedSecret: "secret", timeoutMs: 250, fallback: deterministicFeedRanker, fetchImplementation });
    for (let attempt = 0; attempt < 8; attempt += 1) await ranker.rank(candidates, context);
    expect(fetchImplementation).toHaveBeenCalledTimes(5);
  });

  it("sends only valid topic slugs and the clamped boost policy", () => {
    const request = buildIntelligenceFeedRequest(candidates, context);
    expect(request.candidates[0]?.hashtags).toEqual(["afrobeats"]);
    expect(request.viewer.followedAccountIds).toEqual(["author_b"]);
    expect(request.boostPolicy.tierBoosts.black_official).toBeLessThanOrEqual(1.15);
  });
});
