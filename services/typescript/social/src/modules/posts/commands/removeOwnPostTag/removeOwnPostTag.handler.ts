import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postTagRepository } from "../../repositories/postTag.repository.js";
import type { RemoveOwnPostTagCommand } from "./removeOwnPostTag.command.js";

export function createRemoveOwnPostTagHandler(context: HandlerContext): Handler<RemoveOwnPostTagCommand, void> {
  return async ({ actorId, postId }) => {
    await postTagRepository.removeOne(context.database.client, postId, actorId);
  };
}
