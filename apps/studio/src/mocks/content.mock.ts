import { ApiError } from "@/errors/api.error";
import type { MyPost, PostAnalytics } from "@/types/audience.type";

import { createMockRoute, type MockRoute } from "./registry.mock";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const posts: readonly MyPost[] = [
  { id: "post_clip_1", kind: "clip", createdAt: daysAgo(1), text: "Throwing a 2kg pot in under a minute", media: [{ type: "video", posterUrl: null, url: null }], likes: 1840, comments: 122, reposts: 40, shares: 96, views: 24_300, saveCount: 310, durationSeconds: 48, subscriberOnly: false },
  { id: "post_2", kind: "post", createdAt: daysAgo(3), text: "New glaze colours drop on Sunday's live. Which one first?", media: [{ type: "image", posterUrl: null, url: null }], likes: 402, comments: 88, reposts: 5, shares: 12, views: 5_120, saveCount: 21, durationSeconds: null, subscriberOnly: false },
  { id: "post_clip_3", kind: "clip", createdAt: daysAgo(6), text: "Subscriber-only: kiln loading walkthrough", media: [{ type: "video", posterUrl: null, url: null }], likes: 96, comments: 14, reposts: 0, shares: 2, views: 610, saveCount: 18, durationSeconds: 132, subscriberOnly: true },
];

function buildAnalytics(post: MyPost): PostAnalytics {
  const isVideo = post.media.some((media) => media.type === "video");
  const engagements = post.likes + post.comments + post.reposts + post.shares + post.saveCount;
  const videoViews = Math.round(post.views * 0.8);
  const watch = Math.round(videoViews * (post.durationSeconds ?? 0) * 0.55);
  return {
    postId: post.id, kind: post.kind, postedAt: post.createdAt, impressions: post.views, uniqueViewers: Math.round(post.views * 0.7), reach: Math.round(post.views * 0.7),
    likes: post.likes, comments: post.comments, reposts: post.reposts, shares: post.shares, saves: post.saveCount, profileVisits: Math.round(post.views * 0.02), linkClicks: 0, newFollows: Math.round(post.views * 0.004),
    engagements, engagementRate: post.views === 0 ? 0 : Math.round((engagements / post.views) * 10_000) / 10_000,
    video: isVideo ? { views: videoViews, watchTimeSeconds: watch, averageWatchSeconds: videoViews === 0 ? 0 : Math.round((watch / videoViews) * 10) / 10, completedViews: Math.round(videoViews * 0.31), completionRate: 0.31 } : null,
    audience: [{ label: "Followers", share: 0.38 }, { label: "Non-followers", share: 0.62 }],
    daily: Array.from({ length: 7 }, (_, index) => ({ day: daysAgo(6 - index).slice(0, 10), impressions: Math.round((post.views / 7) * (0.6 + index * 0.1)) })),
  };
}

const followers = ["Kemi Ade", "Chidi Okafor", "Bola Tinubu", "Amaka Eze", "Tobi Bakare"].map((name, index) => ({
  id: `f_${index}`, name, username: name.toLowerCase().replace(/\s+/g, "."), avatarUrl: null, verified: false, isCreator: false, isFollowing: index % 2 === 0, followState: "accepted",
}));

export const contentMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/:userId/posts", ({ query }) => {
    const kind = query.get("kind");
    return { data: kind ? posts.filter((post) => post.kind === kind) : posts, nextCursor: null };
  }),
  createMockRoute("GET", "/api/v1/posts/:postId/analytics", ({ params }) => {
    const post = posts.find((candidate) => candidate.id === params.postId);
    if (!post) throw new ApiError(404, "Post not found.", "POST_NOT_FOUND");
    return buildAnalytics(post);
  }),
  createMockRoute("GET", "/api/v1/users/:userId/followers", () => ({ data: followers, nextCursor: null })),
  createMockRoute("GET", "/api/v1/rankings", ({ query }) => {
    const board = query.get("board");
    if (!["streamer", "supporter", "creator", "engagement"].includes(board ?? "")) throw new ApiError(400, "board must be one of streamer, supporter, creator, engagement", "VALIDATION_FAILED");
    const me = { id: "u_me", name: "Temitope Adeyemi", username: "temi.creates", avatarUrl: null };
    const others = ["Dami Live", "Sade Sings", "Kunle Plays"].map((name, index) => ({ id: `r_${index}`, name, username: name.toLowerCase().replace(/\s+/g, "."), avatarUrl: null }));
    return { data: [...others, me].map((user, index) => ({ rank: index + 1, user, points: 90_000 - index * 12_000 })), nextCursor: null };
  }),
];
