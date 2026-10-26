import { describe, expect, it } from "vitest";

import { createGetPostAnalyticsHandler } from "../../src/modules/posts/queries/getPostAnalytics/getPostAnalytics.handler.js";
import { buildPostViews } from "../../src/modules/posts/services/postView.service.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { authorId, buildFakeContext, buildPostRow, viewerId } from "./socialPostFakes.fake.js";

const viewerA = "0192f0a0-0000-7000-8000-00000000b002";
const viewerB = "0192f0a0-0000-7000-8000-00000000b003";

describe("post analytics data sources", () => {
  it("exposes the persisted public view count on the post/feed DTO", async () => {
    const row = buildPostRow({ viewCount: 37 });
    const views = await buildPostViews(buildFakeContext([row]), viewerId, [row]);

    expect(views[0]?.views).toBe(37);
  });

  it("returns owner analytics from persisted counters without duplicating profile visits as clicks", async () => {
    const post = buildPostRow({
      authorId: viewerId,
      kind: "clip",
      viewCount: 20,
      profileVisitCount: 3,
      likeCount: 4,
      commentCount: 2,
      repostCount: 1,
      shareCount: 2,
      linkPreview: { url: "https://example.test" } as never,
      media: [{ type: "video" }] as never,
    });
    const database = {
      post: { findFirst: async () => post },
      postDailyStat: {
        findMany: async () => [{ day: "2026-10-26", impressions: 8 }],
        aggregate: async () => ({ _sum: { videoViews: 6, watchTimeSeconds: 42, completedViews: 4, linkClicks: 2, newFollows: 1 } }),
      },
      postViewer: {
        count: async () => 2,
        findMany: async () => [{ viewerKey: viewerA }, { viewerKey: viewerB }],
      },
      savedItem: { count: async () => 5 },
      follow: { count: async () => 1 },
    };
    const context = {
      database: { client: database },
      directory: { findUserSummaries: async () => new Map([[viewerId, { id: viewerId, name: "Owner", username: "owner", avatarUrl: null, verified: false, isCreator: false }]]) },
      clock: { now: () => new Date("2026-10-26T12:00:00Z") },
    } as unknown as HandlerContext;

    const result = await createGetPostAnalyticsHandler(context)({ viewerId, postId: post.id });

    expect(result).toMatchObject({
      impressions: 20,
      uniqueViewers: 2,
      reach: 2,
      profileVisits: 3,
      linkClicks: 2,
      newFollows: 1,
      video: { views: 6, watchTimeSeconds: 42, completedViews: 4 },
      audience: [{ label: "Followers", share: 0.5 }, { label: "Non-followers", share: 0.5 }],
    });
    expect(result).not.toHaveProperty("profileClicks");
  });

  it("keeps analytics owner-only", async () => {
    const post = buildPostRow({ authorId });
    const context = {
      database: { client: { post: { findFirst: async () => post } } },
      directory: { findOwnedPostableProfile: async () => null },
    } as unknown as HandlerContext;

    await expect(createGetPostAnalyticsHandler(context)({ viewerId, postId: post.id }))
      .rejects.toMatchObject({ status: 403, code: "NOT_POST_OWNER" });
  });
});
