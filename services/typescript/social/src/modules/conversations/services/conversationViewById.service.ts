import { notFound } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { ConversationView } from "../models/conversation.model.js";
import { conversationRepository } from "../repositories/conversation.repository.js";
import { buildConversationViews } from "./conversationView.service.js";

export async function loadConversationViewForMember(context: HandlerContext, conversationId: string, viewerId: string): Promise<ConversationView> {
  const conversation = await conversationRepository.findById(context.database.client, conversationId);
  const member = conversation?.members.find((candidate) => candidate.accountId === viewerId);
  if (conversation === null || member === undefined) throw notFound("CONVERSATION_NOT_FOUND", "Conversation not found.");
  const [view] = await buildConversationViews(context, viewerId, [{ ...member, conversation }]);
  if (view === undefined) throw notFound("CONVERSATION_NOT_FOUND", "Conversation not found.");
  return view;
}
