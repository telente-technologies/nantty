import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { blockRepository } from "../../blocks/repositories/block.repository.js";
import { followRepository } from "../../follows/repositories/follow.repository.js";
import { isAllMention, type MentionEntity, type MentionSurface } from "../models/mention.model.js";
import { applyMentionPolicy, type MentionLookups, type MentionPolicyResult } from "./mentionPolicy.service.js";

export interface GroupMentionContext {
  readonly memberIds: ReadonlySet<string>;
  readonly authorRole: "owner" | "admin" | "member" | undefined;
  readonly onlyAdminsCanMentionAll: boolean;
}

export interface PrepareMentionsRequest {
  readonly surface: MentionSurface;
  readonly authorId: string;
  readonly text: string | null;
  readonly entities: readonly MentionEntity[] | undefined;
  readonly group?: GroupMentionContext;
}

const emptyResult: MentionPolicyResult = { entities: [], userIdsToNotify: [], mentionsAll: false };

export async function prepareMentionsForWrite(context: HandlerContext, request: PrepareMentionsRequest): Promise<MentionPolicyResult> {
  const entities = request.entities ?? [];
  if (entities.length === 0) return emptyResult;
  const targetIds = [...new Set(entities.flatMap((entity) => (isAllMention(entity) ? [] : [entity.userId])))];
  const db = context.database.client;
  const [summaries, statuses, privacy, followers, blockers, blocked] = await Promise.all([
    context.directory.findUserSummaries(targetIds),
    context.directory.findMentionTargetStatuses(targetIds),
    context.directory.findMentionPrivacy(targetIds),
    Promise.all(targetIds.map(async (targetId) => ((await followRepository.find(db, targetId, request.authorId))?.state === "accepted" ? targetId : undefined))),
    blockRepository.blockersOfViewer(db, request.authorId, targetIds),
    blockRepository.blockedByViewer(db, request.authorId, targetIds),
  ]);
  const lookups: MentionLookups = {
    usernameByUserId: new Map([...summaries].map(([userId, summary]) => [userId, summary.username])),
    statusByUserId: new Map([...statuses].map(([userId, status]) => [userId, status.status])),
    privacyByUserId: privacy,
    userIdsWhoFollowAuthor: new Set(followers.filter((id): id is string => id !== undefined)),
    blockedEitherWayUserIds: new Set([...blockers, ...blocked]),
    groupMemberIds: request.group?.memberIds ?? new Set(),
    authorGroupRole: request.group?.authorRole,
    onlyAdminsCanMentionAll: request.group?.onlyAdminsCanMentionAll ?? false,
  };
  return applyMentionPolicy({ surface: request.surface, authorId: request.authorId, text: request.text, entities, lookups });
}

export function keepMentionsWithinText(entities: readonly MentionEntity[] | undefined, text: string): readonly MentionEntity[] | undefined {
  return entities?.filter((entity) => entity.start + entity.length <= text.length);
}
