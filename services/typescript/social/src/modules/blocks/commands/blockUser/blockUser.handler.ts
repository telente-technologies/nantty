import { notFound, unprocessable } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { blockUserInTransaction } from "../../services/blockUserInTransaction.service.js";
import type { BlockUserCommand } from "./blockUser.command.js";

export function createBlockUserHandler(context: HandlerContext): Handler<BlockUserCommand, void> {
  return async ({ blockerId, targetId }) => {
    if (blockerId === targetId) throw unprocessable("CANNOT_BLOCK_SELF", "You can't block yourself.");
    if (!(await context.directory.findUserSummaries([targetId])).has(targetId)) throw notFound("USER_NOT_FOUND", "User not found.");
    await context.database.transaction((transaction) => blockUserInTransaction(transaction, blockerId, targetId, context.clock.now()));
  };
}
