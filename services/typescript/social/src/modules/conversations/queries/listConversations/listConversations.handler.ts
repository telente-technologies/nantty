import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { buildPageFromOverfetchedRows } from "../../../../utils/cursor.util.js";
import { chatSettingsRepository } from "../../../chatSettings/repositories/chatSettings.repository.js";
import { toChatSettingsView } from "../../../chatSettings/models/chatSettingsView.model.js";
import { followRepository } from "../../../follows/repositories/follow.repository.js";
import type { ConversationView } from "../../models/conversation.model.js";
import { conversationRepository, type MemberWithConversation } from "../../repositories/conversation.repository.js";
import { buildConversationViews } from "../../services/conversationView.service.js";
import { isRequestVisibleToRecipient } from "../../services/messageRequestRules.service.js";
import type { ListConversationsQuery } from "./listConversations.query.js";

async function dropRequestsOutsideAudience(context: HandlerContext, viewerId: string, rows: readonly MemberWithConversation[]): Promise<MemberWithConversation[]> {
  const db = context.database.client;
  const audience = toChatSettingsView(await chatSettingsRepository.find(db, viewerId)).messageRequestsFrom;
  const kept: MemberWithConversation[] = [];
  for (const row of rows) {
    const peerId = row.conversation.kind === "direct" ? row.conversation.members.find((member) => member.accountId !== viewerId)?.accountId : undefined;
    if (peerId === undefined) {
      kept.push(row);
      continue;
    }
    const [viewerFollowsPeer, peerFollowsViewer] = await Promise.all([followRepository.find(db, viewerId, peerId), followRepository.find(db, peerId, viewerId)]);
    if (isRequestVisibleToRecipient(audience, viewerFollowsPeer?.state === "accepted", peerFollowsViewer?.state === "accepted")) kept.push(row);
  }
  return kept;
}

export function createListConversationsHandler(context: HandlerContext): Handler<ListConversationsQuery, Page<ConversationView>> {
  return async ({ viewerId, folder, filter, cursor, limit }) => {
    const rows = await conversationRepository.pageForMember(context.database.client, viewerId, folder, filter === "direct" ? ["direct"] : undefined, limit, cursor);
    const page = buildPageFromOverfetchedRows(rows.map((row) => ({ ...row, id: row.conversationId })), limit);
    const visible = folder === "requests" ? await dropRequestsOutsideAudience(context, viewerId, page.data) : page.data;
    return { data: await buildConversationViews(context, viewerId, visible), nextCursor: page.nextCursor };
  };
}
