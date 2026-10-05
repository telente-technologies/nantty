import { forbidden, notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import type { ConversationView } from "../../models/conversation.model.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";
import { loadConversationViewForMember } from "../../services/conversationViewById.service.js";
import type { ChannelSubscriptionCommand } from "./subscribeToChannel.command.js";

export function createSubscribeToChannelHandler(context: HandlerContext): Handler<ChannelSubscriptionCommand, ConversationView> {
  return async ({ viewerId, channelId }) => {
    const db = context.database.client;
    const channel = await conversationRepository.findById(db, channelId);
    if (channel === null || channel.kind !== "channel") throw notFound("CHANNEL_NOT_FOUND", "Channel not found.");
    const existing = channel.members.find((member) => member.accountId === viewerId);
    if (existing !== undefined) return loadConversationViewForMember(context, channelId, viewerId);
    if (await blockRepository.eitherDirection(db, viewerId, channel.createdById)) throw forbidden("CHANNEL_NOT_AVAILABLE", "You can't join this channel.");
    await conversationRepository.upsertMember(db, channelId, viewerId, "subscriber", "chats");
    return loadConversationViewForMember(context, channelId, viewerId);
  };
}
