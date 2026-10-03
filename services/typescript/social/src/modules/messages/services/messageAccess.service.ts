import { notFound } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { requireConversationMember } from "../../conversations/services/conversationAccess.service.js";
import { messageRepository, type MessageRow } from "../repositories/message.repository.js";

export async function loadMessageForMember(context: HandlerContext, messageId: string, viewerId: string): Promise<MessageRow> {
  const row = await messageRepository.findById(context.database.client, messageId, viewerId);
  if (row === null) throw notFound("MESSAGE_NOT_FOUND", "Message not found.");
  await requireConversationMember(context.database.client, row.conversationId, viewerId);
  return row;
}
