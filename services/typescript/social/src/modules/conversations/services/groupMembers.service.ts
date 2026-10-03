import { maximumGroupMembers } from "../../../constants/social.constant.js";
import { unprocessable } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { blockRepository } from "../../blocks/repositories/block.repository.js";
import type { ConversationMemberView } from "../models/conversation.model.js";
import { conversationRepository } from "../repositories/conversation.repository.js";

export async function resolveAddableMemberIds(context: HandlerContext, actorId: string, candidateIds: readonly string[], currentMemberIds: readonly string[]): Promise<string[]> {
  const unique = [...new Set(candidateIds)].filter((id) => id !== actorId && !currentMemberIds.includes(id));
  if (unique.length + currentMemberIds.length > maximumGroupMembers) throw unprocessable("GROUP_FULL", `A group can have up to ${maximumGroupMembers} members.`);
  const [summaries, blocked] = await Promise.all([context.directory.findUserSummaries(unique), blockRepository.everyoneBlockedByOrBlocking(context.database.client, actorId)]);
  return unique.filter((id) => summaries.has(id) && !blocked.has(id));
}

export async function listMemberViews(context: HandlerContext, conversationId: string): Promise<ConversationMemberView[]> {
  const conversation = await conversationRepository.findById(context.database.client, conversationId);
  if (conversation === null) return [];
  const summaries = await context.directory.findUserSummaries(conversation.members.map((member) => member.accountId));
  return conversation.members.flatMap((member) => {
    const user = summaries.get(member.accountId);
    return user === undefined ? [] : [{ user, role: member.role === "owner" || member.role === "admin" ? member.role : ("member" as const) }];
  });
}
