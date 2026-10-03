import { maximumMentionsPerContent } from "../../../constants/social.constant.js";
import { unprocessable } from "../../../errors/social.error.js";
import type { MentionTargetStatus, WhoCanMentionMe } from "../../../interfaces/identityDirectory.interface.js";
import { isAllMention, type MentionEntity, type MentionSurface } from "../models/mention.model.js";

export interface MentionLookups {
  readonly usernameByUserId: ReadonlyMap<string, string>;
  readonly statusByUserId: ReadonlyMap<string, MentionTargetStatus>;
  readonly privacyByUserId: ReadonlyMap<string, WhoCanMentionMe>;
  readonly userIdsWhoFollowAuthor: ReadonlySet<string>;
  readonly blockedEitherWayUserIds: ReadonlySet<string>;
  readonly groupMemberIds: ReadonlySet<string>;
  readonly authorGroupRole: "owner" | "admin" | "member" | undefined;
  readonly onlyAdminsCanMentionAll: boolean;
}

export interface MentionPolicyInput {
  readonly surface: MentionSurface;
  readonly authorId: string;
  readonly text: string | null;
  readonly entities: readonly MentionEntity[];
  readonly lookups: MentionLookups;
}

export interface MentionPolicyResult {
  readonly entities: readonly MentionEntity[];
  readonly userIdsToNotify: readonly string[];
  readonly mentionsAll: boolean;
}

function isWithinText(entity: MentionEntity, text: string | null): boolean {
  if (!Number.isInteger(entity.start) || !Number.isInteger(entity.length) || entity.start < 0 || entity.length < 2) return false;
  return text === null || (entity.start + entity.length <= text.length && text[entity.start] === "@");
}

function removeOverlaps(entities: readonly MentionEntity[]): MentionEntity[] {
  const kept: MentionEntity[] = [];
  let furthestEnd = 0;
  for (const entity of [...entities].sort((left, right) => left.start - right.start)) {
    if (entity.start < furthestEnd) continue;
    kept.push(entity);
    furthestEnd = entity.start + entity.length;
  }
  return kept;
}

function mayMentionEveryone(input: MentionPolicyInput): boolean {
  if (input.surface !== "group") return false;
  const { authorGroupRole, onlyAdminsCanMentionAll } = input.lookups;
  if (authorGroupRole === undefined) return false;
  return !onlyAdminsCanMentionAll || authorGroupRole === "owner" || authorGroupRole === "admin";
}

function mayMentionUser(input: MentionPolicyInput, userId: string): boolean {
  const { lookups, authorId, surface } = input;
  if (userId === authorId) return false;
  if (lookups.statusByUserId.get(userId) !== "active") return false;
  if (lookups.blockedEitherWayUserIds.has(userId)) return false;
  if (surface === "group" && !lookups.groupMemberIds.has(userId)) return false;
  const privacy = lookups.privacyByUserId.get(userId) ?? "everyone";
  if (privacy === "no_one") return false;
  if (privacy === "following" && !lookups.userIdsWhoFollowAuthor.has(userId)) return false;
  return true;
}

export function applyMentionPolicy(input: MentionPolicyInput): MentionPolicyResult {
  if (input.entities.length > maximumMentionsPerContent) {
    throw unprocessable("TOO_MANY_MENTIONS", `You can mention at most ${maximumMentionsPerContent} people.`, { maximum: maximumMentionsPerContent });
  }
  const inBounds = input.entities.filter((entity) => isWithinText(entity, input.text));
  const survivors: MentionEntity[] = [];
  for (const entity of removeOverlaps(inBounds)) {
    if (isAllMention(entity)) {
      if (mayMentionEveryone(input)) survivors.push({ type: "all", start: entity.start, length: entity.length });
      continue;
    }
    const username = input.lookups.usernameByUserId.get(entity.userId);
    if (username !== undefined && mayMentionUser(input, entity.userId)) survivors.push({ userId: entity.userId, username, start: entity.start, length: entity.length });
  }
  const mentionsAll = survivors.some(isAllMention);
  const userIdsToNotify = input.surface === "direct" ? [] : [...new Set(survivors.flatMap((entity) => (isAllMention(entity) ? [] : [entity.userId])))];
  return { entities: survivors, userIdsToNotify, mentionsAll };
}
