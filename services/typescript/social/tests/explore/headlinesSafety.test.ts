import { beforeEach, describe, expect, it } from "vitest";

import { clearHeadlineCache, computeHeadlines } from "../../src/modules/explore/services/headlines.service.js";
import { clearExploreCaches } from "../../src/modules/explore/services/trends.service.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

interface FakePost {
  readonly id: string;
  readonly authorId: string;
  readonly text: string;
  readonly sensitiveLabels: readonly string[];
}

function buildContext(posts: readonly FakePost[], removals: readonly { kind: "headline"; key: string; country: string; reason: string }[] = [], headlineCalls: unknown[] = []): HandlerContext {
  const rows = posts.map((post) => ({ ...post, createdAt: new Date("2026-10-04T11:00:00Z"), likeCount: 5, commentCount: 1, repostCount: 0, shareCount: 0, viewCount: 50, saveCount: 0 }));
  const client = {
    post: { findMany: async ({ where }: { where: { sensitiveLabels?: { isEmpty?: boolean } } }) => rows.filter((row) => where.sensitiveLabels?.isEmpty !== true || row.sensitiveLabels.length === 0) },
    postMedia: { findFirst: async () => null },
  };
  return {
    database: { client },
    directory: { findPrivateAccountIds: async () => new Set(), findUserSummaries: async () => new Map() },
    clock: { now: () => new Date("2026-10-04T12:00:00Z") },
    rankingSettings: { read: async () => ({ boostPolicy: { version: 0, tierBoosts: {}, officialEditorialBoost: 1 }, trendRemovals: removals }) },
    intelligenceExplore: { readTrendingHashtags: async () => null, buildHeadlines: async (input: unknown) => (headlineCalls.push(input), null) },
  } as unknown as HandlerContext;
}

const story = (index: number, extra: Partial<FakePost> = {}): FakePost => ({ id: `p${index}`, authorId: `a${index}`, text: "Lagos Fashion Week tonight #lagosfashionweek", sensitiveLabels: [], ...extra });

describe("headline safety", () => {
  beforeEach(() => {
    clearExploreCaches();
    clearHeadlineCache();
  });

  it("never includes sensitive posts and falls back to the template when intelligence fails", async () => {
    const calls: unknown[] = [];
    const page = await computeHeadlines(buildContext([story(1), story(2), story(3), story(4, { sensitiveLabels: ["nudity"] })], [], calls), { country: null, category: null, limit: 5 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ sourceLabel: "Summarised from posts", generatedBy: "template_v1" });
    expect(page.items[0]?.postIds).not.toContain("p4");
    expect(JSON.stringify(calls)).not.toContain("\"p4\"");
  });

  it("drops a headline an admin removed for policy", async () => {
    const page = await computeHeadlines(buildContext([story(1), story(2), story(3)], [{ kind: "headline", key: "lagosfashionweek", country: "", reason: "misinformation" }]), { country: null, category: null, limit: 5 });
    expect(page.items).toEqual([]);
  });
});
