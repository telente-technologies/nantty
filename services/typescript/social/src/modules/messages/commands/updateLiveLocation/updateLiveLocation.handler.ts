import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { activeMemberIds, messageUpdatedEvent } from "../../services/chatRealtimeEvents.service.js";
import { unprocessable } from "../../../../errors/social.error.js";
import type { Prisma } from "../../../../generated/prisma/client.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { MessageView } from "../../models/message.model.js";
import { messageRepository } from "../../repositories/message.repository.js";
import { loadMessageForMember } from "../../services/messageAccess.service.js";
import { buildMessageViews } from "../../services/messageView.service.js";
import { assertLiveLocationEditableBy } from "../../services/liveLocation.service.js";
import type { UpdateLiveLocationCommand } from "./updateLiveLocation.command.js";

export function createUpdateLiveLocationHandler(context: HandlerContext): Handler<UpdateLiveLocationCommand, MessageView> {
  return async ({ viewerId, messageId, latitude, longitude, address }) => {
    if (!(latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180)) throw unprocessable("LOCATION_INVALID", "The coordinates are out of range.");
    const row = await loadMessageForMember(context, messageId, viewerId);
    const now = context.clock.now();
    const current = assertLiveLocationEditableBy(row, viewerId, now);
    await messageRepository.update(context.database.client, messageId, { location: { ...current, latitude, longitude, address: address ?? current.address, updatedAt: now.toISOString() } as unknown as Prisma.InputJsonValue });
    const updated = await loadMessageForMember(context, messageId, viewerId);
    await appendDomainEventsToOutbox(context.database.client, [messageUpdatedEvent(updated, await activeMemberIds(context.database.client, updated.conversationId), now)]);
    return (await buildMessageViews(context, viewerId, [updated], { peerLastReadAt: null, isDirect: false }))[0] as MessageView;
  };
}
