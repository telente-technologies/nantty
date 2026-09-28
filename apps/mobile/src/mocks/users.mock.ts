import type { ConnectionEntry } from "@/types/account.type";
import type { Post, User } from "@/types";

import { buildMockUserSummary, isoDateHoursAgo, me } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const LONG_POST_TEXT =
  "Figma ipsum component variant main layer. Group export vector mask community object arrow ellipse image scale. Flows duplicate shadow outline variant rectangle comment edit. Distribute slice overflow layer overflow layer vertical star follower. Connection content export list draft plugin export rotate shadow figma. Select text flatten slice image follower flows. Duplicate object content export slice align.";

let myProfile: User = { ...me, name: "Profile Name", username: "username" };

const creatorProfile = (userId: string): User => ({
  ...me,
  id: userId,
  name: "Profile Name",
  username: "username",
  isFollowing: false,
  isSeller: true,
  storeId: "s_1",
});

const buildProfilePost = (index: number, authorId: string): Post => ({
  id: `p_${authorId}_${index}`,
  kind: "post",
  author: { ...buildMockUserSummary(index), id: authorId },
  createdAt: isoDateHoursAgo(48),
  text: LONG_POST_TEXT,
  media: [{ type: "image", url: null }],
  likes: 100,
  comments: 21,
  reposts: 20,
  views: 0,
  liked: false,
  bookmarked: false,
  isFollowingAuthor: true,
  friendsLiked: null,
  products: [{ id: "pr_1", name: "Product Name", price: 2_000_000, imageUrl: null }],
});

const connections: ConnectionEntry[] = [
  { id: "u_enyo", name: "Enyo Dev", username: "mayweda_dev", avatarUrl: null, verified: false, isFollowing: true },
  { id: "u_support", name: "Zudo Support", username: "zudosupport", avatarUrl: null, verified: true, isFollowing: true },
];

let blocked: ConnectionEntry[] = [
  { id: "u_blocked", name: "Carlos Trantow", username: "carlos_t", avatarUrl: null, verified: false, isFollowing: false },
];

export const usersMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/me", () => myProfile),
  createMockRoute("PATCH", "/api/v1/users/me", ({ body }) => {
    myProfile = { ...myProfile, ...(body as Partial<User>) };
    return myProfile;
  }),
  createMockRoute("GET", "/api/v1/users/me/blocked", () => blocked),
  createMockRoute("GET", "/api/v1/users/:userId", ({ params }) =>
    params.userId === myProfile.id ? myProfile : creatorProfile(params.userId!),
  ),
  createMockRoute("GET", "/api/v1/users/:userId/posts", ({ params }) => ({
    data: [0, 1, 2].map((i) => buildProfilePost(i, params.userId!)),
    nextCursor: null,
  })),
  createMockRoute("GET", "/api/v1/users/:userId/connections", ({ query }) =>
    query.get("tab") === "blocked" ? blocked : connections,
  ),
  createMockRoute("POST", "/api/v1/users/:userId/follow", () => undefined),
  createMockRoute("DELETE", "/api/v1/users/:userId/follow", () => undefined),
  createMockRoute("POST", "/api/v1/users/:userId/block", () => undefined),
  createMockRoute("DELETE", "/api/v1/users/:userId/block", ({ params }) => {
    blocked = blocked.filter((entry) => entry.id !== params.userId);
  }),
];
