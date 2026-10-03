import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { followRepository } from "../../repositories/follow.repository.js";
import type { UnfollowUserCommand } from "./unfollowUser.command.js";

export function createUnfollowUserHandler(context: HandlerContext): Handler<UnfollowUserCommand, void> {
  return async ({ followerId, targetId }) => {
    const existing = await followRepository.find(context.database.client, followerId, targetId);
    if (existing === null) return;
    await context.database.transaction(async (transaction) => {
      await followRepository.delete(transaction, followerId, targetId);
      if (existing.state === "accepted") {
        await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.followRemoved, subject: existing.id, occurredAt: context.clock.now(), data: { followId: existing.id, followerId, followeeId: targetId } }]);
      }
    });
  };
}
