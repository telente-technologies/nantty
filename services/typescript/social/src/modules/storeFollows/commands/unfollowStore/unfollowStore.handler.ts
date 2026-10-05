import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { storeFollowRepository } from "../../repositories/storeFollow.repository.js";
import type { UnfollowStoreCommand } from "./unfollowStore.command.js";

export function createUnfollowStoreHandler(context: HandlerContext): Handler<UnfollowStoreCommand, void> {
  return async ({ followerId, storeId }) => {
    const now = context.clock.now();
    await context.database.transaction(async (transaction) => {
      if (await storeFollowRepository.unfollow(transaction, followerId, storeId)) {
        await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.storeUnfollowed, subject: storeId, occurredAt: now, data: { storeId, followerId } }]);
      }
    });
  };
}
