import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { StoreFollowState } from "../../models/storeFollow.model.js";
import { storeFollowRepository } from "../../repositories/storeFollow.repository.js";
import { assertStoreFollowable } from "../../services/storeExistence.service.js";
import type { FollowStoreCommand } from "./followStore.command.js";

export function createFollowStoreHandler(context: HandlerContext): Handler<FollowStoreCommand, StoreFollowState> {
  return async ({ followerId, storeId }) => {
    await assertStoreFollowable(context, storeId, followerId);
    const now = context.clock.now();
    const db = context.database.client;
    await context.database.transaction(async (transaction) => {
      const wasFollowing = await storeFollowRepository.isFollowing(transaction, followerId, storeId);
      await storeFollowRepository.follow(transaction, followerId, storeId, now);
      if (!wasFollowing) await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.storeFollowed, subject: storeId, occurredAt: now, data: { storeId, followerId } }]);
    });
    return { storeId, isFollowing: true, followers: await storeFollowRepository.countFollowers(db, storeId) };
  };
}
