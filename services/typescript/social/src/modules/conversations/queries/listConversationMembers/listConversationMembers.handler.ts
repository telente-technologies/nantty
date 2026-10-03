import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ConversationMemberView } from "../../models/conversation.model.js";
import { requireConversationMember } from "../../services/conversationAccess.service.js";
import { listMemberViews } from "../../services/groupMembers.service.js";
import type { ListConversationMembersQuery } from "./listConversationMembers.query.js";

export function createListConversationMembersHandler(context: HandlerContext): Handler<ListConversationMembersQuery, ConversationMemberView[]> {
  return async ({ viewerId, conversationId }) => {
    await requireConversationMember(context.database.client, conversationId, viewerId);
    return listMemberViews(context, conversationId);
  };
}
