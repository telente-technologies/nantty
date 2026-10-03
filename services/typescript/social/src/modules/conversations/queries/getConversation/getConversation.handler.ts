import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ConversationView } from "../../models/conversation.model.js";
import { loadConversationViewForMember } from "../../services/conversationViewById.service.js";
import type { GetConversationQuery } from "./getConversation.query.js";

export function createGetConversationHandler(context: HandlerContext): Handler<GetConversationQuery, ConversationView> {
  return ({ viewerId, conversationId }) => loadConversationViewForMember(context, conversationId, viewerId);
}
