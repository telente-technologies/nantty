import type { Page, TaggedUser, UserSummary } from "@/types";

import { createMockRoute, type MockRoute } from "./registry.mock";
import { isFollowingUser } from "./socialGraph.mock";
import { SUSPENDED_USER_IDS, findDirectoryUserById, summariseUser, type DirectoryUserId } from "./userDirectory.mock";

const INLINE_TAGGED_PREVIEW = 3;
const TAGGED_PAGE_SIZE = 10;

const TAGGED_USER_IDS_BY_POST: Readonly<Record<string, readonly DirectoryUserId[]>> = {
  post_3: ["u_7", "u_12", "u_15", "u_10"],
  post_5: ["u_11"],
  post_6: ["u_1", "u_3", "u_5", "u_8", "u_9", "u_10", "u_11", "u_12", "u_13", "u_14", "u_15", "u_17", "u_18", "u_19", "u_20", "u_21"],
  post_18: ["u_20", "u_23"],
  post_24: ["u_7", "u_12", "u_20"],
  clip_amaka_haul: ["u_13", "u_3"],
  clip_blessing_wedding: ["u_9", "u_1", "u_10", "u_21", "u_15"],
  clip_bisola_jollof: ["u_10"],
};

const toTaggedUser = (user: UserSummary): TaggedUser => {
  const verification = user.verification;
  const showsCheckmark = verification ? verification.badgeVisible && verification.status === "active" && verification.tier !== "ESSENTIAL" : user.verified;
  return {
    id: user.id,
    username: user.username,
    displayName: user.name,
    avatarUrl: user.avatarUrl,
    checkmark: showsCheckmark ? (verification?.color ?? "blue") : null,
    isFollowing: isFollowingUser(user.id),
  };
};

const listTaggedUsersForPost = (postId: string): TaggedUser[] =>
  (TAGGED_USER_IDS_BY_POST[postId] ?? [])
    .filter((userId) => !SUSPENDED_USER_IDS.has(userId))
    .map(findDirectoryUserById)
    .filter((user) => !!user)
    .map((user) => toTaggedUser(summariseUser(user!)));

export const taggedUsersFieldsForPost = (postId: string): { taggedUsers?: readonly TaggedUser[]; taggedUsersCount?: number } => {
  const tagged = listTaggedUsersForPost(postId);
  return tagged.length ? { taggedUsers: tagged.slice(0, INLINE_TAGGED_PREVIEW), taggedUsersCount: tagged.length } : {};
};

export const taggedUsersMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/posts/:postId/tagged-users", ({ params, query }) => {
    const tagged = listTaggedUsersForPost(params.postId!);
    const start = Number(query.get("cursor") ?? 0) || 0;
    const end = start + TAGGED_PAGE_SIZE;
    const page: Page<TaggedUser> = { data: tagged.slice(start, end), nextCursor: end < tagged.length ? String(end) : null };
    return page;
  }),
];
