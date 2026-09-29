import { ApiError } from "@/errors/api.error";
import type { Post } from "@/types";

import { mockPostsState, sponsoredFeedPosts, withCurrentProductPrices } from "./postCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

export { mockPostsState };

export const findPostIncludingSponsored = (postId: string): Post | undefined =>
  mockPostsState.get(postId) ?? sponsoredFeedPosts.find((post) => post.id === postId);

const updateMockPost = (postId: string, change: (post: Post) => Post) => {
  const post = mockPostsState.get(postId);
  if (post) mockPostsState.set(postId, change(post));
};

export const postsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/posts/:postId", ({ params }) => {
    const post = findPostIncludingSponsored(params.postId!);
    if (!post) throw new ApiError(404, "This post was removed");
    return withCurrentProductPrices(post);
  }),
  createMockRoute("POST", "/api/v1/posts/:postId/like", ({ params }) =>
    updateMockPost(params.postId!, (p) => ({ ...p, liked: true, likes: p.liked ? p.likes : p.likes + 1 })),
  ),
  createMockRoute("DELETE", "/api/v1/posts/:postId/like", ({ params }) =>
    updateMockPost(params.postId!, (p) => ({ ...p, liked: false, likes: p.liked ? p.likes - 1 : p.likes })),
  ),
  createMockRoute("POST", "/api/v1/posts/:postId/repost", ({ params }) => updateMockPost(params.postId!, (p) => ({ ...p, reposts: p.reposts + 1 }))),
  createMockRoute("POST", "/api/v1/posts/:postId/share", () => undefined),
];
