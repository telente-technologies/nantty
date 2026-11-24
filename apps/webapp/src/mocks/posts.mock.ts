import { ApiError } from "@/errors/api.error";
import type { Post, PostAnalytics, PostAnalyticsDaily } from "@/types";

import { findMockClipsByIds } from "./clips.mock";
import { findMockVideoById } from "./videos.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { mockPostsState, sponsoredFeedPosts, withCurrentProductPrices } from "./postCatalog.mock";
import { findSeededMockQuote } from "./postAudience.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const deletedMockPostIds = new Set<string>();

export { mockPostsState };

export const findPostIncludingSponsored = (postId: string): Post | undefined =>
  mockPostsState.get(postId) ?? sponsoredFeedPosts.find((post) => post.id === postId);

const updateMockPost = (postId: string, change: (post: Post) => Post) => {
  const post = mockPostsState.get(postId);
  if (post) mockPostsState.set(postId, change(post));
};

const DAY_WEIGHTS: readonly number[] = [0.09, 0.12, 0.15, 0.18, 0.16, 0.17, 0.13];

const buildDailyImpressions = (impressions: number): PostAnalyticsDaily[] => {
  const dayInMs = 86_400_000;
  const firstDay = Date.now() - (DAY_WEIGHTS.length - 1) * dayInMs;
  return DAY_WEIGHTS.map((weight, index) => ({
    day: new Date(firstDay + index * dayInMs).toISOString(),
    impressions: Math.round(impressions * weight),
  }));
};

const buildVideoAnalytics = (views: number, watchTimeSeconds: number, completedViews: number) => ({
  views,
  watchTimeSeconds,
  completedViews,
  averageWatchSeconds: views > 0 ? Math.round((watchTimeSeconds / views) * 10) / 10 : 0,
  completionRate: views > 0 ? Math.round((completedViews / views) * 1000) / 1000 : 0,
});

const buildPostAnalytics = (post: Post): PostAnalytics => {
  const saves = post.saveCount ?? Math.round(post.likes * 0.15);
  const shares = Math.round(post.reposts * 0.6);
  const linkClicks = Math.round(post.views * 0.011);
  const profileClicks = Math.round(post.views * 0.019);
  const engagements = post.likes + post.comments + post.reposts + saves + shares + linkClicks + profileClicks;
  const isVideo = post.media.some((item) => item.type === "video");
  return {
    postId: post.id,
    kind: post.kind === "clip" ? "clip" : "post",
    hasLink: !!post.linkPreview,
    author: post.author,
    postedAt: post.createdAt,
    impressions: post.views,
    uniqueViewers: Math.round(post.views * 0.68),
    likes: post.likes,
    comments: post.comments,
    reposts: post.reposts,
    profileVisits: Math.round(post.views * 0.042),
    saves,
    shares,
    linkClicks,
    profileClicks,
    newFollows: Math.round(post.views * 0.0025),
    engagements,
    engagementRate: post.views > 0 ? Math.round((engagements / post.views) * 1000) / 10 : 0,
    video: isVideo ? buildVideoAnalytics(Math.round(post.views * 0.55), Math.round(post.views * 0.55 * 11), Math.round(post.views * 0.55 * 0.42)) : null,
    audience: [
      { label: "Followers", share: 38 },
      { label: "Non-followers", share: 62 },
    ],
    daily: buildDailyImpressions(post.views),
  };
};

export const postsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/posts/:postId", ({ params }) => {
    const post = findPostIncludingSponsored(params.postId!) ?? findMockClipsByIds([params.postId!])[0] ?? findSeededMockQuote(params.postId!) ?? findMockVideoById(params.postId!);
    if (!post) throw new ApiError(404, "This post was removed");
    return withCurrentProductPrices(post);
  }),
  createMockRoute("POST", "/api/v1/posts/:postId/like", ({ params }) =>
    updateMockPost(params.postId!, (p) => ({ ...p, liked: true, likes: p.liked ? p.likes : p.likes + 1 })),
  ),
  createMockRoute("DELETE", "/api/v1/posts/:postId/like", ({ params }) =>
    updateMockPost(params.postId!, (p) => ({ ...p, liked: false, likes: p.liked ? p.likes - 1 : p.likes })),
  ),
  createMockRoute("POST", "/api/v1/posts/:postId/repost", ({ params }) =>
    updateMockPost(params.postId!, (p) => (p.reposted === true ? p : { ...p, reposted: true, reposts: p.reposts + 1 })),
  ),
  createMockRoute("DELETE", "/api/v1/posts/:postId/repost", ({ params }) => {
    updateMockPost(params.postId!, (p) => (p.reposted === true ? { ...p, reposted: false, reposts: Math.max(0, p.reposts - 1) } : p));
    return undefined;
  }),
  createMockRoute("POST", "/api/v1/posts/:postId/share", () => undefined),
  createMockRoute("GET", "/api/v1/posts/:postId/notifications-mute", ({ params }) => {
    return { postId: params.postId!, muted: mockPostsState.get(params.postId!)?.viewerNotificationsMuted === true };
  }),
  createMockRoute("PUT", "/api/v1/posts/:postId/notifications-mute", ({ params }) => {
    if (!findPostIncludingSponsored(params.postId!)) throw new ApiError(404, "Post not found.", "POST_NOT_FOUND");
    updateMockPost(params.postId!, (p) => ({ ...p, viewerNotificationsMuted: true }));
    return { postId: params.postId!, muted: true };
  }),
  createMockRoute("DELETE", "/api/v1/posts/:postId/notifications-mute", ({ params }) => {
    updateMockPost(params.postId!, (p) => ({ ...p, viewerNotificationsMuted: false }));
    return { postId: params.postId!, muted: false };
  }),
  createMockRoute("PUT", "/api/v1/posts/:postId/pin", ({ params }) => {
    const post = mockPostsState.get(params.postId!);
    if (!post) throw new ApiError(404, "This post was removed");
    if (post.author.id !== getSignedInMockUser().id) throw new ApiError(403, "You can only pin your own posts.", "FORBIDDEN");
    if (post.isPinned !== true) {
      const pinnedCount = [...mockPostsState.values()].filter((candidate) => candidate.author.id === post.author.id && candidate.isPinned === true).length;
      if (pinnedCount >= 3) throw new ApiError(409, "You can only pin up to 3 posts on your profile.", "PIN_LIMIT_REACHED");
      updateMockPost(params.postId!, (p) => ({ ...p, isPinned: true, pinnedAt: new Date().toISOString() }));
    }
    return mockPostsState.get(params.postId!);
  }),
  createMockRoute("DELETE", "/api/v1/posts/:postId/pin", ({ params }) => {
    const post = mockPostsState.get(params.postId!);
    if (!post) throw new ApiError(404, "This post was removed");
    if (post.author.id !== getSignedInMockUser().id) throw new ApiError(403, "You can only unpin your own posts.", "FORBIDDEN");
    updateMockPost(params.postId!, (p) => ({ ...p, isPinned: false, pinnedAt: null }));
    return mockPostsState.get(params.postId!);
  }),
  createMockRoute("DELETE", "/api/v1/posts/:postId", ({ params }) => {
    const postId = params.postId!;
    if (deletedMockPostIds.has(postId)) return undefined;
    const post = mockPostsState.get(postId);
    if (!post) throw new ApiError(404, "This post was removed", "POST_NOT_FOUND");
    if (post.author.id !== getSignedInMockUser().id) throw new ApiError(403, "Only the author can delete this post.", "NOT_POST_OWNER");
    mockPostsState.delete(postId);
    deletedMockPostIds.add(postId);
    const originalId = post.isQuote ? post.resharedFrom?.id : undefined;
    if (originalId) updateMockPost(originalId, (p) => ({ ...p, reposts: Math.max(0, p.reposts - 1), quotes: Math.max(0, (p.quotes ?? 0) - 1) }));
    for (const [id, candidate] of mockPostsState) if (candidate.resharedFrom?.id === postId) mockPostsState.set(id, { ...candidate, resharedFrom: null, resharedFromUnavailable: true });
    return undefined;
  }),
  createMockRoute("GET", "/api/v1/posts/:postId/analytics", ({ params }) => {
    const post = findPostIncludingSponsored(params.postId!) ?? findMockClipsByIds([params.postId!])[0];
    if (!post) throw new ApiError(404, "This post was removed");
    if (post.author.id !== getSignedInMockUser().id) throw new ApiError(403, "Only the author of a post can see its analytics.", "NOT_POST_OWNER");
    return buildPostAnalytics(post);
  }),
];
