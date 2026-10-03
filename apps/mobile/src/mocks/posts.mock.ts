import { ApiError } from "@/errors/api.error";
import type { Post, PostAnalytics, PostAnalyticsDaily } from "@/types";

import { getSignedInMockUser } from "./fixtures.mock";
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

const buildPostAnalytics = (post: Post): PostAnalytics => ({
  postId: post.id,
  author: post.author,
  postedAt: post.createdAt,
  impressions: post.views,
  uniqueViewers: Math.round(post.views * 0.68),
  likes: post.likes,
  comments: post.comments,
  reposts: post.reposts,
  profileVisits: Math.round(post.views * 0.042),
  daily: buildDailyImpressions(post.views),
});

export const postsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/posts/:postId", ({ params }) => {
    const post = findPostIncludingSponsored(params.postId!);
    if (!post) throw new ApiError(404, "This post was removed");
    return withViewerSavedState(withCurrentProductPrices(post));
  }),
  createMockRoute("POST", "/api/v1/posts/:postId/like", ({ params }) =>
    updateMockPost(params.postId!, (p) => ({ ...p, liked: true, likes: p.liked ? p.likes : p.likes + 1 })),
  ),
  createMockRoute("DELETE", "/api/v1/posts/:postId/like", ({ params }) =>
    updateMockPost(params.postId!, (p) => ({ ...p, liked: false, likes: p.liked ? p.likes - 1 : p.likes })),
  ),
  createMockRoute("POST", "/api/v1/posts/:postId/repost", ({ params, body }) => {
    const original = findPostIncludingSponsored(params.postId!);
    if (!original) throw new ApiError(404, "This post was removed");
    updateMockPost(params.postId!, (p) => ({ ...p, reposts: p.reposts + 1 }));
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
      isFollowingAuthor: false,
      friendsLiked: null,
      products: [],
      sponsored: null,
      resharedFrom: withCurrentProductPrices(original),
    };
    mockPostsState.set(reshare.id, reshare);
    return reshare;
  }),
  createMockRoute("POST", "/api/v1/posts/:postId/share", () => undefined),
  createMockRoute("GET", "/api/v1/posts/:postId/analytics", ({ params }) => {
    const post = findPostIncludingSponsored(params.postId!);
    if (!post) throw new ApiError(404, "This post was removed");
    if (post.author.id !== getSignedInMockUser().id) throw new ApiError(403, "Only the author of a post can see its analytics.", "NOT_POST_OWNER");
    return buildPostAnalytics(post);
  }),
];
