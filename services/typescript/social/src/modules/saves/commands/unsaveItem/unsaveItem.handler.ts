import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { savedItemRepository } from "../../repositories/savedItem.repository.js";
import type { UnsaveItemCommand } from "./unsaveItem.command.js";

export function createUnsaveItemHandler(context: HandlerContext): Handler<UnsaveItemCommand, void> {
  return async ({ userId, type, targetId }) => {
    await savedItemRepository.delete(context.database.client, userId, type, targetId);
  };
}
