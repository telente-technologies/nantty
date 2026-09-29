import type { Post } from "@/types";

import { buildMockProductSummary } from "./commerceFixtures.mock";
import { buildMockUserSummary, isoDateHoursAgo } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const SHORT_TEXT = "Figma ipsum component variant main layer. Group export vector mask community object arrow ellipse ";
const LONG_TEXT =
  "Figma ipsum component variant main layer. Group export vector mask community object arrow ellipse image scale. Flows duplicate shadow outline variant rectangle comment edit. Distribute slice overflow layer overflow layer vertical star follower. Connection content export list draft plugin export rotate shadow figma. Select text flatten slice image follower flows. Duplicate object content export slice align.";

export const buildMockFeedPost = (index: number): Post => ({
  id: `post_${index}`,
  kind: "post",
  author: buildMockUserSummary(index),
  createdAt: isoDateHoursAgo(48),
  text: index % 3 === 2 ? LONG_TEXT : SHORT_TEXT,
  media: [
    { type: "image", url: null },
    { type: "image", url: null },
    { type: "image", url: null },
    { type: "image", url: null },
  ],
  likes: 100,
  comments: 21,
  reposts: 20,
  views: 100_000,
  liked: false,
  bookmarked: false,
  isFollowingAuthor: index % 3 !== 1,
  friendsLiked: index % 3 === 2 ? null : { count: 12, avatars: [null, null, null] },
  products: Array.from({ length: 4 }, (_, i) => buildMockProductSummary(200 + i, "Product Name", 1_300)),
});

export const mockPostsState = new Map<string, Post>(Array.from({ length: 30 }, (_, i) => [`post_${i}`, buildMockFeedPost(i)]));

const updateMockPost = (postId: string, change: (post: Post) => Post) => {
  const post = mockPostsState.get(postId);
  if (post) mockPostsState.set(postId, change(post));
};

export const postsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/posts/:postId", ({ params }) => mockPostsState.get(params.postId!) ?? buildMockFeedPost(0)),
  createMockRoute("POST", "/api/v1/posts/:postId/like", ({ params }) =>
    updateMockPost(params.postId!, (p) => ({ ...p, liked: true, likes: p.liked ? p.likes : p.likes + 1 })),
  ),
  createMockRoute("DELETE", "/api/v1/posts/:postId/like", ({ params }) =>
    updateMockPost(params.postId!, (p) => ({ ...p, liked: false, likes: p.liked ? p.likes - 1 : p.likes })),
  ),
  createMockRoute("POST", "/api/v1/posts/:postId/repost", ({ params }) => updateMockPost(params.postId!, (p) => ({ ...p, reposts: p.reposts + 1 }))),
  createMockRoute("POST", "/api/v1/posts/:postId/share", () => undefined),
  createMockRoute("POST", "/api/v1/users/:userId/follow", ({ params }) => {
    for (const [id, post] of mockPostsState) if (post.author.id === params.userId) mockPostsState.set(id, { ...post, isFollowingAuthor: true });
  }),
];
