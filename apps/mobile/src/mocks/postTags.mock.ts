import { ApiError } from "@/errors/api.error";
import { MAXIMUM_TAGGED_PEOPLE, type CategorizedNotification, type ID, type TagCandidate, type UserSummary } from "@/types";

import { getSignedInMockUser } from "./fixtures.mock";
import { userIdsWhoBlockedTheAuthor } from "./mentionRules.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { directoryUsers, summariseUser } from "./userDirectory.mock";

const MAXIMUM_CANDIDATES = 15;
const TAGGING_OFF_REASON = "Doesn't allow tags";

export const userIdsWhoTurnedOffTagging: ReadonlySet<string> = new Set(["u_10"]);
export const taggedUserIdsByPostId = new Map<ID, readonly ID[]>();
const tagNotificationsByRecipientId = new Map<ID, CategorizedNotification[]>();
let nextTagNotificationSequence = 1;

const isTaggable = (userId: string, authorId: string) => !userIdsWhoTurnedOffTagging.has(userId) && !userIdsWhoBlockedTheAuthor.has(userId) && userId !== authorId;

export const sanitizeTaggedUserIds = (authorId: string, requested: readonly ID[] | undefined): readonly ID[] => {
  const unique = [...new Set(requested ?? [])];
  if (unique.length > MAXIMUM_TAGGED_PEOPLE) throw new ApiError(422, `You can tag up to ${MAXIMUM_TAGGED_PEOPLE} people`, "TOO_MANY_TAGS");
  return unique.filter((userId) => directoryUsers.some((user) => user.id === userId && user.account?.status === "active") && isTaggable(userId, authorId));
};

export const recordTagNotifications = (author: UserSummary, postId: ID, kind: "post" | "clip", taggedUserIds: readonly ID[]) => {
  taggedUserIdsByPostId.set(postId, taggedUserIds);
  for (const recipientId of taggedUserIds) {
    const notification: CategorizedNotification = {
      id: `n_tag_${nextTagNotificationSequence++}`,
      category: "social",
      kind: "postTag",
      title: author.name,
      body: `tagged you in a ${kind}. You can remove yourself from the post's menu.`,
      createdAt: new Date().toISOString(),
      read: false,
      actor: author,
    };
    tagNotificationsByRecipientId.set(recipientId, [notification, ...(tagNotificationsByRecipientId.get(recipientId) ?? [])]);
  }
};

export const listTagNotificationsFor = (userId: string) => tagNotificationsByRecipientId.get(userId) ?? [];

export const postTagsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/tags/candidates", ({ query }) => {
    const author = getSignedInMockUser();
    const term = (query.get("q") ?? "").trim().replace(/^@/, "").toLowerCase();
    const candidates: TagCandidate[] = directoryUsers
      .filter((user) => user.id !== author.id && user.account?.status === "active" && !userIdsWhoBlockedTheAuthor.has(user.id))
      .filter((user) => !term || user.name.toLowerCase().includes(term) || user.username.toLowerCase().includes(term))
      .slice(0, MAXIMUM_CANDIDATES)
      .map((user) => {
        const canTag = isTaggable(user.id, author.id);
        return { user: summariseUser(user), canTag, unavailableReason: canTag ? null : TAGGING_OFF_REASON };
      });
    return { candidates };
  }),
];
