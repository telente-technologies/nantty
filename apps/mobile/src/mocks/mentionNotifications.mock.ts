import type { UserSummary } from "@/types";
import type { CategorizedNotification } from "@/types/commerce.type";
import type { MentionSurface } from "@/types/mention.type";

import { isoDateHoursAgo } from "./fixtures.mock";
import { userSummaryById } from "./userDirectory.mock";

const mentionNotificationsByRecipientId = new Map<string, CategorizedNotification[]>([
  [
    "u_me",
    [
      { id: "n_m1", category: "social", kind: "mention", title: "Adaeze Okafor", body: "mentioned you in a comment.", createdAt: isoDateHoursAgo(4), read: false, actor: userSummaryById("u_1") },
      { id: "n_m2", category: "social", kind: "mention", title: "Amaka Chukwu", body: "mentioned everyone in a group.", createdAt: isoDateHoursAgo(11), read: true, actor: userSummaryById("u_13") },
    ],
  ],
]);

const placeLabelBySurface: Readonly<Record<MentionSurface, string>> = { post: "a post", comment: "a comment", group: "a group", direct: "a chat" };

let nextMentionNotificationSequence = 1;

export const recordMentionNotifications = (actor: UserSummary, recipientUserIds: readonly string[], surface: MentionSurface, mentionedEveryone = false) => {
  const verb = mentionedEveryone ? "mentioned everyone in" : "mentioned you in";
  for (const recipientId of new Set(recipientUserIds)) {
    if (recipientId === actor.id) continue;
    const notification: CategorizedNotification = {
      id: `n_m_${nextMentionNotificationSequence++}`,
      category: "social",
      kind: "mention",
      title: actor.name,
      body: `${verb} ${placeLabelBySurface[surface]}.`,
      createdAt: new Date().toISOString(),
      read: false,
      actor,
    };
    mentionNotificationsByRecipientId.set(recipientId, [notification, ...(mentionNotificationsByRecipientId.get(recipientId) ?? [])]);
  }
};

export const listMentionNotificationsFor = (userId: string): CategorizedNotification[] => mentionNotificationsByRecipientId.get(userId) ?? [];

export const recordVideoReplyNotification = (author: UserSummary, commenterUserId: string) => {
  if (commenterUserId === author.id) return;
  const notification: CategorizedNotification = {
    id: `n_vr_${nextMentionNotificationSequence++}`,
    category: "social",
    kind: "videoReply",
    title: author.name,
    body: `@${author.username} replied to your comment with a video`,
    createdAt: new Date().toISOString(),
    read: false,
    actor: author,
  };
  mentionNotificationsByRecipientId.set(commenterUserId, [notification, ...(mentionNotificationsByRecipientId.get(commenterUserId) ?? [])]);
};
