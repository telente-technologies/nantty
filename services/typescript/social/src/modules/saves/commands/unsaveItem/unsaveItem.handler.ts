import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { savedItemRepository } from "../../repositories/savedItem.repository.js";
import type { UnsaveItemCommand } from "./unsaveItem.command.js";

export function createUnsaveItemHandler(context: HandlerContext): Handler<UnsaveItemCommand, void> {
  return async ({ userId, type, targetId }) => {
    await context.database.client.$transaction((transaction) => savedItemRepository.unsaveAndCount(transaction, userId, type, targetId));
  };
}
