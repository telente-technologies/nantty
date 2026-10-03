import { unprocessable } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { createBlockUserHandler } from "../../../blocks/commands/blockUser/blockUser.handler.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";
import { findDirectPeerId, requireConversationMember } from "../../services/conversationAccess.service.js";
import type { BlockConversationPeerCommand } from "./blockConversationPeer.command.js";

export function createBlockConversationPeerHandler(context: HandlerContext): Handler<BlockConversationPeerCommand, void> {
  const blockUser = createBlockUserHandler(context);
  return async ({ viewerId, conversationId }) => {
    const { conversation } = await requireConversationMember(context.database.client, conversationId, viewerId);
    const peerId = findDirectPeerId(conversation, viewerId);
    if (peerId === undefined) throw unprocessable("NOT_A_DIRECT_CONVERSATION", "Only a one-to-one chat has a person to block.");
    await blockUser({ blockerId: viewerId, targetId: peerId });
    await conversationRepository.updateMember(context.database.client, conversationId, viewerId, { leftAt: context.clock.now(), unreadCount: 0 });
  };
}
