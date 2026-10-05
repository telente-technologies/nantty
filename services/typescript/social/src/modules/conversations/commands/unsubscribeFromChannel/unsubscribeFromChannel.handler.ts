import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { membershipEndedEvent } from "../../../messages/services/chatRealtimeEvents.service.js";
import { notFound, unprocessable } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ChannelSubscriptionCommand } from "../subscribeToChannel/subscribeToChannel.command.js";
import { conversationRepository } from "../../repositories/conversation.repository.js";

export function createUnsubscribeFromChannelHandler(context: HandlerContext): Handler<ChannelSubscriptionCommand, void> {
  return async ({ viewerId, channelId }) => {
    const db = context.database.client;
    const channel = await conversationRepository.findById(db, channelId);
    if (channel === null || channel.kind !== "channel") throw notFound("CHANNEL_NOT_FOUND", "Channel not found.");
    const member = channel.members.find((candidate) => candidate.accountId === viewerId);
    if (member === undefined) return;
    if (member.role === "owner") throw unprocessable("OWNER_CANNOT_UNSUBSCRIBE", "Hand the channel to another admin before leaving it.");
    const now = context.clock.now();
    await context.database.transaction(async (transaction) => {
      await conversationRepository.updateMember(transaction, channelId, viewerId, { leftAt: now, unreadCount: 0 });
      await appendDomainEventsToOutbox(transaction, [membershipEndedEvent(channelId, viewerId, "left", now)]);
    });
  };
}
