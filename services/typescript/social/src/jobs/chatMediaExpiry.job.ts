import { appendDomainEventsToOutbox } from "../events/outbox.event.js";
import { socialEventTypes } from "../events/eventTypes.event.js";
import { messageRepository } from "../modules/messages/repositories/message.repository.js";
import type { HandlerContext } from "../types/handlerContext.type.js";

const batchSize = 500;

export async function runChatMediaExpiry(context: HandlerContext): Promise<number> {
  const now = context.clock.now();
  let purged = 0;
  for (;;) {
    const expired = await messageRepository.findExpiredMedia(context.database.client, now, batchSize);
    if (expired.length === 0) break;
    await context.database.transaction(async (transaction) => {
      await messageRepository.markMediaPurged(transaction, expired.map((row) => row.id), now);
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.chatMediaExpired, subject: "chatMedia", occurredAt: now, data: { messageIds: expired.map((row) => row.id), mediaIds: expired.flatMap((row) => (row.mediaId === null ? [] : [row.mediaId])) } }]);
    });
    purged += expired.length;
    if (expired.length < batchSize) break;
  }
  await messageRepository.deleteDisappeared(context.database.client, now);
  if (purged > 0) await context.database.client.chatMediaExpiryRun.create({ data: { purgedCount: purged } });
  return purged;
}
