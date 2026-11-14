import { socialEventTypes } from "../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../events/outbox.event.js";
import type { Db } from "../../../types/database.type.js";
import { followRepository } from "../../follows/repositories/follow.repository.js";
import { blockRepository } from "../repositories/block.repository.js";

export async function blockUserInTransaction(db: Db, blockerId: string, blockedId: string, now: Date): Promise<void> {
  const created = await blockRepository.createIfMissing(db, blockerId, blockedId);
  if (!created) return;
  await followRepository.deleteBothDirections(db, blockerId, blockedId);
  await appendDomainEventsToOutbox(db, [{
    eventType: socialEventTypes.userBlocked,
    subject: blockerId,
    occurredAt: now,
    data: { blockerId, blockedId },
  }]);
}
