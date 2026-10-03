import { notFound, unprocessable } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { followRepository } from "../../../follows/repositories/follow.repository.js";
import { blockRepository } from "../../repositories/block.repository.js";
import type { BlockUserCommand } from "./blockUser.command.js";

export function createBlockUserHandler(context: HandlerContext): Handler<BlockUserCommand, void> {
  return async ({ blockerId, targetId }) => {
    if (blockerId === targetId) throw unprocessable("CANNOT_BLOCK_SELF", "You can't block yourself.");
    if (!(await context.directory.findUserSummaries([targetId])).has(targetId)) throw notFound("USER_NOT_FOUND", "User not found.");
    if (await blockRepository.exists(context.database.client, blockerId, targetId)) return;
    await context.database.transaction(async (transaction) => {
      await blockRepository.create(transaction, blockerId, targetId);
      await followRepository.deleteBothDirections(transaction, blockerId, targetId);
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.userBlocked, subject: blockerId, occurredAt: context.clock.now(), data: { blockerId, blockedId: targetId } }]);
    });
  };
}
