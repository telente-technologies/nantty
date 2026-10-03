import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { blockRepository } from "../../repositories/block.repository.js";
import type { UnblockUserCommand } from "./unblockUser.command.js";

export function createUnblockUserHandler(context: HandlerContext): Handler<UnblockUserCommand, void> {
  return async ({ blockerId, targetId }) => {
    await context.database.transaction(async (transaction) => {
      const removed = await blockRepository.delete(transaction, blockerId, targetId);
      if (removed.count === 0) return;
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.userUnblocked, subject: blockerId, occurredAt: context.clock.now(), data: { blockerId, blockedId: targetId } }]);
    });
  };
}
