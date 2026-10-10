import { ApiError } from "@/errors/api.error";
import type { Post, PostAnalytics, PostAnalyticsDaily } from "@/types";

import { getSignedInMockUser } from "./fixtures.mock";
import { isOwnedProfileOfSignedInUser } from "./brands.mock";
import { isAuthorContentVisibleToSignedInViewer } from "./socialGraph.mock";
import { mockPostsState, sponsoredFeedPosts, withCurrentProductPrices } from "./postCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { withViewerSavedState } from "./savedEntries.mock";

export { mockPostsState };

export const findPostIncludingSponsored = (postId: string): Post | undefined => {
  const post = mockPostsState.get(postId) ?? sponsoredFeedPosts.find((candidate) => candidate.id === postId);
  return post && isAuthorContentVisibleToSignedInViewer(post.author.id) ? post : undefined;
};

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

const buildPostAnalytics = (post: Post): PostAnalytics => {
  const saves = post.saveCount ?? Math.round(post.likes * 0.15);
  const shares = Math.round(post.reposts * 0.6);
  const linkClicks = Math.round(post.views * 0.011);
  const profileClicks = Math.round(post.views * 0.019);
  const engagements = post.likes + post.comments + post.reposts + saves + shares + linkClicks + profileClicks;
  const isVideo = post.media.some((item) => item.type === "video");
  return {
    postId: post.id,
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
    video: isVideo ? { views: Math.round(post.views * 0.55), watchTimeSeconds: Math.round(post.views * 0.55 * 11) } : null,
    audience: [
      { label: "Followers", share: 38 },
      { label: "Non-followers", share: 62 },
    ],
    daily: buildDailyImpressions(post.views),
  };
};

export const postsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/posts/:postId", ({ params, isGuest }) => {
    const post = findPostIncludingSponsored(params.postId!);
    if (!post) throw new ApiError(404, "This post was removed");
    if (isGuest && (post.sensitive?.labels ?? []).some((label) => label === "nudity" || label === "dangerous_acts")) throw new ApiError(404, "This post isn't available.", "POST_NOT_AVAILABLE");
    return withViewerSavedState(withCurrentProductPrices(post));
  }),
  createMockRoute("POST", "/api/v1/posts/:postId/link-preview", ({ params }) => findPostIncludingSponsored(params.postId!)?.linkPreview ?? null),
  createMockRoute("POST", "/api/v1/posts/:postId/like", ({ params }) =>
    updateMockPost(params.postId!, (p) => ({ ...p, liked: true, likes: p.liked ? p.likes : p.likes + 1 })),
  ),
  createMockRoute("DELETE", "/api/v1/posts/:postId/like", ({ params }) =>
    updateMockPost(params.postId!, (p) => ({ ...p, liked: false, likes: p.liked ? p.likes - 1 : p.likes })),
  ),
  createMockRoute("POST", "/api/v1/posts/:postId/repost", ({ params, body }) => {
    const original = findPostIncludingSponsored(params.postId!);
    if (!original) throw new ApiError(404, "This post was removed");
    const quoteText = typeof (body as { text?: unknown } | null)?.text === "string" ? (body as { text: string }).text.trim() : "";
    const reshare: Post = {
      id: `reshare_${original.id}_${mockPostsState.size}`,
      kind: "post",
      author: getSignedInMockUser(),
      createdAt: new Date().toISOString(),
      text: quoteText,
      media: [],
      likes: 0,
      comments: 0,
      reposts: 0,
      views: 0,
      liked: false,
      bookmarked: false,
      saveCount: 0,
      isFollowingAuthor: false,
      friendsLiked: null,
      products: [],
      sponsored: null,
      resharedFrom: withCurrentProductPrices(original),
      isQuote: quoteText !== "",
      quotes: 0,
      replyPolicy: "everyone",
      viewerCanReply: true,
      replyRestriction: null,
      sensitive: null,
    };
    updateMockPost(params.postId!, (p) => ({ ...p, reposts: p.reposts + 1, quotes: (p.quotes ?? 0) + (quoteText !== "" ? 1 : 0) }));
    mockPostsState.set(reshare.id, reshare);
    return reshare;
  }),
  createMockRoute("POST", "/api/v1/posts/:postId/share", () => undefined),
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
  createMockRoute("GET", "/api/v1/posts/:postId/analytics", ({ params }) => {
    const post = findPostIncludingSponsored(params.postId!);
    if (!post) throw new ApiError(404, "This post was removed");
    if (post.author.id !== getSignedInMockUser().id && !isOwnedProfileOfSignedInUser(post.author.id)) throw new ApiError(403, "Only the author of a post can see its analytics.", "NOT_POST_OWNER");
    return buildPostAnalytics(post);
  }),
];
