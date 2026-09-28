import type { Page, Post } from "@/types";

import { mockPostsState } from "./posts.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const TOPICS = ["For You", "Computing", "Technology", "Blockchain", "Health", "Gadgets", "Design"];

const pageOfPosts = (cursor: string | null, filter: (post: Post) => boolean = () => true): Page<Post> => {
  const all = [...mockPostsState.values()].filter(filter);
  const start = Number(cursor ?? 0);
  return { data: all.slice(start, start + 6), nextCursor: start + 6 < all.length ? String(start + 6) : null };
};

export const feedMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/feeds/for-you", ({ query }) => pageOfPosts(query.get("cursor"))),
  createMockRoute("GET", "/api/v1/feeds/following", ({ query }) => pageOfPosts(query.get("cursor"), (p) => p.isFollowingAuthor)),
  createMockRoute("GET", "/api/v1/feeds/suggested-clips", () => Array.from({ length: 6 }, (_, i) => ({ id: `clip_${i}`, thumbnailUrl: null }))),
  createMockRoute("GET", "/api/v1/users/me/topics", () => TOPICS.slice(1).map((name, i) => ({ id: `t_${i + 1}`, name }))),
];
