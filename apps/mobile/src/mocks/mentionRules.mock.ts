import { ApiError } from "@/errors/api.error";
import type { UserSummary } from "@/types";
import type { MentionEntity, MentionSurface, WhoCanMentionMe } from "@/types/mention.type";
import { MAXIMUM_MENTIONS_PER_CONTENT, isAllMention } from "@/utils/mentions.util";

import { recordMentionNotifications } from "./mentionNotifications.mock";
import { followerUserIds } from "./socialGraph.mock";
import { findDirectoryUserById } from "./userDirectory.mock";

export interface GroupMentionContext {
  readonly memberUserIds: readonly string[];
  readonly authorIsAdmin: boolean;
  readonly onlyAdminsCanMentionAll: boolean;
}

export type GroupMentionLookup = (conversationId: string, authorId: string) => GroupMentionContext | null;

export const mentionPrivacyByUserId = new Map<string, WhoCanMentionMe>([
  ["u_me", "everyone"],
  ["u_8", "no_one"],
  ["u_20", "following"],
]);

export const userIdsWhoBlockedTheAuthor: ReadonlySet<string> = new Set(["u_14"]);

export const recentlyInteractedUserIds: readonly string[] = ["u_21", "u_10", "u_13", "u_7"];

let lookupGroupMentionContext: GroupMentionLookup = () => null;

export const registerGroupMentionLookup = (lookup: GroupMentionLookup) => {
  lookupGroupMentionContext = lookup;
};

export const getGroupMentionContext = (conversationId: string, authorId: string) => lookupGroupMentionContext(conversationId, authorId);

export const doesUserAllowMentionsFromAuthor = (targetUserId: string, authorId: string) => {
  const setting = mentionPrivacyByUserId.get(targetUserId) ?? "everyone";
  if (setting === "no_one") return false;
  if (setting === "following") return authorId === "u_me" && followerUserIds.includes(targetUserId);
  return true;
};

export interface SanitizedMentions {
  readonly mentions: readonly MentionEntity[];
  readonly notifiedUserIds: readonly string[];
  readonly mentionedEveryone: boolean;
}

export type MentionWriteSurface = MentionSurface | "direct";

export const sanitizeMentionsForWrite = (
  author: UserSummary,
  entities: readonly MentionEntity[] | undefined,
  surface: MentionWriteSurface,
  conversationId?: string,
): SanitizedMentions => {
  const requested = entities ?? [];
  if (requested.length > MAXIMUM_MENTIONS_PER_CONTENT) {
    throw new ApiError(422, `You can mention up to ${MAXIMUM_MENTIONS_PER_CONTENT} people at once`, "TOO_MANY_MENTIONS");
  }
  const groupContext = surface === "group" && conversationId ? getGroupMentionContext(conversationId, author.id) : null;
  const kept: MentionEntity[] = [];
  const notifiedUserIds: string[] = [];
  let mentionedEveryone = false;
  for (const entity of requested) {
    if (isAllMention(entity)) {
      if (!groupContext || (groupContext.onlyAdminsCanMentionAll && !groupContext.authorIsAdmin)) continue;
      mentionedEveryone = true;
      kept.push(entity);
      continue;
    }
    if (!findDirectoryUserById(entity.userId)) continue;
    if (userIdsWhoBlockedTheAuthor.has(entity.userId)) continue;
    if (!doesUserAllowMentionsFromAuthor(entity.userId, author.id)) continue;
    if (surface === "group" && !groupContext?.memberUserIds.includes(entity.userId)) continue;
    kept.push(entity);
    if (surface !== "direct" && findDirectoryUserById(entity.userId)?.account?.status === "active") notifiedUserIds.push(entity.userId);
  }
  return { mentions: kept, notifiedUserIds, mentionedEveryone };
};

export const notifyMentionedUsers = (author: UserSummary, sanitized: SanitizedMentions, surface: MentionSurface, conversationId?: string) => {
  recordMentionNotifications(author, sanitized.notifiedUserIds, surface);
  if (!sanitized.mentionedEveryone || !conversationId) return;
  const everyoneElse = (getGroupMentionContext(conversationId, author.id)?.memberUserIds ?? []).filter((userId) => !sanitized.notifiedUserIds.includes(userId));
  recordMentionNotifications(author, everyoneElse, surface, true);
};
