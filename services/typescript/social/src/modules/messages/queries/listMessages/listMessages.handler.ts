import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { buildPageFromOverfetchedRows } from "../../../../utils/cursor.util.js";
import { findDirectPeerId, requireConversationMember } from "../../../conversations/services/conversationAccess.service.js";
import type { MessageView } from "../../models/message.model.js";
import { messageRepository } from "../../repositories/message.repository.js";
import { buildMessageViews } from "../../services/messageView.service.js";
import type { ListMessagesQuery } from "./listMessages.query.js";

export function createListMessagesHandler(context: HandlerContext): Handler<ListMessagesQuery, Page<MessageView>> {
  return async ({ viewerId, conversationId, cursor, after, limit }) => {
    const db = context.database.client;
    const { conversation, member } = await requireConversationMember(db, conversationId, viewerId);
    const now = context.clock.now();
    const peer = conversation.members.find((candidate) => candidate.accountId === findDirectPeerId(conversation, viewerId));
    const options = { isDirect: peer !== undefined, peerLastReadAt: member.inboxFolder === "chats" && peer?.inboxFolder === "chats" ? (peer.lastReadAt ?? null) : null };
    if (after !== undefined) return { data: await buildMessageViews(context, viewerId, await messageRepository.listAfter(db, conversationId, viewerId, now, after), options), nextCursor: null };
    const page = buildPageFromOverfetchedRows(await messageRepository.pageNewestFirst(db, conversationId, viewerId, now, limit, cursor), limit);
    return { data: await buildMessageViews(context, viewerId, page.data, options), nextCursor: page.nextCursor };
  };
}
