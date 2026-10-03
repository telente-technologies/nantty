import { forbidden, notFound } from "../../../errors/social.error.js";
import type { Db } from "../../../types/database.type.js";
import { conversationRepository, type ConversationRow, type MemberRow } from "../repositories/conversation.repository.js";

export interface MemberAccess {
  readonly conversation: ConversationRow;
  readonly member: MemberRow;
}

export async function requireConversationMember(db: Db, conversationId: string, accountId: string): Promise<MemberAccess> {
  const conversation = await conversationRepository.findById(db, conversationId);
  if (conversation === null) throw notFound("CONVERSATION_NOT_FOUND", "Conversation not found.");
  const member = conversation.members.find((candidate) => candidate.accountId === accountId);
  if (member === undefined) throw notFound("CONVERSATION_NOT_FOUND", "Conversation not found.");
  return { conversation, member };
}

export function requireGroupAdmin(access: MemberAccess): void {
  if (access.conversation.kind === "direct") throw forbidden("NOT_A_GROUP", "This action is for groups.");
  if (access.member.role !== "owner" && access.member.role !== "admin") throw forbidden("NOT_GROUP_ADMIN", "Only admins can do this.");
}

export function findDirectPeerId(conversation: ConversationRow, viewerId: string): string | undefined {
  return conversation.kind === "direct" ? conversation.members.find((member) => member.accountId !== viewerId)?.accountId : undefined;
}
