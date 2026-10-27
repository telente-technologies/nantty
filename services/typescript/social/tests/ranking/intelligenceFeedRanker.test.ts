import { describe, expect, it, vi } from "vitest";

import { deterministicFeedRanker } from "../../src/integrations/deterministicFeedRanker.integration.js";
import { buildIntelligenceFeedRequest, createIntelligenceFeedRanker } from "../../src/integrations/intelligenceFeedRanker.integration.js";
import type { RankingCandidate } from "../../src/interfaces/feedRanker.interface.js";
import { createIdentifierHasher, deriveIdentifierHashSecret } from "../../src/utils/identifierHashing.util.js";

const now = new Date("2026-10-04T12:00:00Z");
const candidates: RankingCandidate[] = [
  { postId: "a", authorId: "author_a", createdAt: now, likeCount: 1, commentCount: 0, repostCount: 0, shareCount: 0, viewCount: 10, followedAuthor: false, hashtags: ["afrobeats", "Ünïcode"] },
  { postId: "b", authorId: "author_b", createdAt: now, likeCount: 50, commentCount: 5, repostCount: 0, shareCount: 0, viewCount: 100, followedAuthor: true },
];
const context = { viewerId: "viewer", personalized: true, now };
const hasher = createIdentifierHasher(deriveIdentifierHashSecret("hash-secret", "unused"));

describe("intelligence feed ranker", () => {
  it("uses the Python order and explanations when it answers in time", async () => {
    const fetchImplementation = vi.fn(async () => new Response(JSON.stringify({ items: [{ itemId: "a", explanations: [{ code: "trending_topic", label: "Trending: #afrobeats" }], boostMultiplier: 1 }, { itemId: "b" }], manipulatedItemIds: [] }), { status: 200 }));
    const ranker = createIntelligenceFeedRanker({ baseUrl: "http://intelligence", sharedSecret: "secret", timeoutMs: 250, fallback: deterministicFeedRanker, hasher, fetchImplementation });
    const ranked = await ranker.rank(candidates, context);
    expect(ranked.map((item) => item.postId)).toEqual(["a", "b"]);
    expect(ranked[0]?.explanations?.[0]?.code).toBe("trending_topic");
    const [, init] = fetchImplementation.mock.calls[0] as unknown as [URL, RequestInit];
    expect((init.headers as Record<string, string>)["x-nantty-signature"]).toMatch(/^v1=/);
  });

  it("falls back to the deterministic order when Python is slower than the timeout", async () => {
    const fetchImplementation = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError")))));
    const onFallback = vi.fn();
    const ranker = createIntelligenceFeedRanker({ baseUrl: "http://intelligence", sharedSecret: "secret", timeoutMs: 20, fallback: deterministicFeedRanker, hasher, fetchImplementation, onFallback });
    const ranked = await ranker.rank(candidates, context);
    expect(ranked.map((item) => item.postId)).toEqual((await deterministicFeedRanker.rank(candidates, context)).map((item) => item.postId));
    expect(onFallback).toHaveBeenCalledWith("TimeoutError");
  });

  it("opens the circuit after repeated failures and stops calling Python", async () => {
    const fetchImplementation = vi.fn(async () => new Response("boom", { status: 500 }));
    const ranker = createIntelligenceFeedRanker({ baseUrl: "http://intelligence", sharedSecret: "secret", timeoutMs: 250, fallback: deterministicFeedRanker, hasher, fetchImplementation });
    for (let attempt = 0; attempt < 8; attempt += 1) await ranker.rank(candidates, context);
    expect(fetchImplementation).toHaveBeenCalledTimes(5);
  });

  it("sends only valid topic slugs and the clamped boost policy", () => {
    const request = buildIntelligenceFeedRequest(candidates, context, hasher);
    expect(request.candidates[0]?.hashtags).toEqual(["afrobeats"]);
    expect(request.viewer.followedAccountIds).toEqual([hasher.hashUserId("author_b")]);
    expect(request.boostPolicy.tierBoosts.black_official).toBeLessThanOrEqual(1.15);
  });

  it("sends only hashed user ids to Python", () => {
    const request = buildIntelligenceFeedRequest(candidates, context, hasher);
    const serialised = JSON.stringify(request);
    expect(request.viewer.userId).toMatch(/^u_[0-9a-f]{40}$/);
    expect(request.candidates.map((candidate) => candidate.authorId)).toEqual([hasher.hashUserId("author_a"), hasher.hashUserId("author_b")]);
    expect(serialised).not.toContain("author_a");
  });

  it("matches the legacy hashing contract (u_ + 40 hex of HMAC-SHA256 over user:<id>)", () => {
    const legacy = createIdentifierHasher(deriveIdentifierHashSecret("", "key-material"));
    expect(legacy.hashUserId("abc")).toBe(legacy.hashUserId("abc"));
    expect(hasher.hashUserId("abc")).not.toBe(legacy.hashUserId("abc"));
    expect(hasher.hashSearchQuery("  Ankara   DRESS ")).toBe(hasher.hashSearchQuery("ankara dress"));
    expect(hasher.hashSearchQuery("x")).toMatch(/^q_[0-9a-f]{40}$/);
  });

  it("matches the Python identifier_hashing_service vectors exactly", () => {
    expect(createIdentifierHasher(deriveIdentifierHashSecret("", "shared-secret")).hashUserId("0192f0a0-0000-7000-8000-00000000a001")).toBe("u_11baaae5819d1a17534ae804efc2685db359e6fe");
    const explicit = createIdentifierHasher(deriveIdentifierHashSecret("explicit", "ignored"));
    expect(explicit.hashUserId("abc")).toBe("u_c10937b3436a81539bd288e267afcd451fb1c8e1");
    expect(explicit.hashUserId("u_c10937b3436a81539bd288e267afcd451fb1c8e1")).toBe("u_c10937b3436a81539bd288e267afcd451fb1c8e1");
  });
});
