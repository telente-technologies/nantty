import type { Clip, CommentWithReplies, Post } from "@/types";

import { buildMockUserSummary, isoDateHoursAgo, me } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const caption = "Figma ipsum component variant main layer. Group export vector mask ";

const buildMockClip = (index: number): Clip => ({
  id: `clip_${index}`,
  kind: "clip",
  author: { ...buildMockUserSummary(40 + index), username: "username20" },
  createdAt: isoDateHoursAgo(48),
  text: caption,
  media: [{ type: "video", url: null }],
  likes: 11200,
  comments: 11200,
  reposts: 0,
  views: 11200,
  liked: false,
  bookmarked: false,
  isFollowingAuthor: index % 3 === 1,
  friendsLiked: index % 2 === 0 ? { count: 12, avatars: [null, null, null] } : null,
  products: [],
  durationSeconds: 642,
  sound: "Original sound . username",
});

const commentsByPost = new Map<string, CommentWithReplies[]>();
const seedComments = (postId: string): CommentWithReplies[] =>
  Array.from({ length: 6 }, (_, i) => ({
    id: `cm_${postId}_${i}`,
    author: { ...buildMockUserSummary(60 + i, "testUsername"), username: "testUsername" },
    text: "Lorem ipsum dolor sit amet consectetur. Dictum posuere sit egestas odio convallis arcu rutrum ad nom.",
    createdAt: isoDateHoursAgo(8),
    likes: 11200,
    liked: false,
    replies: 0,
  }));

const commentsFor = (postId: string) => {
  if (!commentsByPost.has(postId)) commentsByPost.set(postId, seedComments(postId));
  return commentsByPost.get(postId)!;
};

export const clipsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/clips", ({ query }) => {
    const offset = query.get("tab") === "following" ? 100 : 0;
    return { data: Array.from({ length: 8 }, (_, i) => buildMockClip(offset + i)), nextCursor: null };
  }),
  createMockRoute("GET", "/api/v1/posts/:postId/comments", ({ params }) => ({ data: commentsFor(params.postId!), nextCursor: null })),
  createMockRoute("POST", "/api/v1/posts/:postId/comments", ({ params, body }) => {
    const comment: CommentWithReplies = {
      id: `cm_${Date.now()}`,
      author: me,
      text: (body as { text: string }).text,
      createdAt: new Date().toISOString(),
      likes: 0,
      liked: false,
      replies: 0,
    };
    commentsByPost.set(params.postId!, [comment, ...commentsFor(params.postId!)]);
    return comment;
  }),
  createMockRoute("POST", "/api/v1/comments/:commentId/like", () => undefined),
  createMockRoute("DELETE", "/api/v1/comments/:commentId/like", () => undefined),
  createMockRoute("POST", "/api/v1/posts", ({ body }) => {
    const input = body as { text: string; media: Post["media"] };
    const post: Post = {
      id: `p_${Date.now()}`,
      kind: "post",
      author: me,
      createdAt: new Date().toISOString(),
      text: input.text,
      media: input.media,
      likes: 0,
      comments: 0,
      reposts: 0,
      views: 0,
      liked: false,
      bookmarked: false,
      isFollowingAuthor: true,
      friendsLiked: null,
      products: [],
    };
    return post;
  }),
];
