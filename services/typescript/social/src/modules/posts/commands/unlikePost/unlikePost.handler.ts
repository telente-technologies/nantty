import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postRepository } from "../../repositories/post.repository.js";
import type { UnlikePostCommand } from "./unlikePost.command.js";

export function createUnlikePostHandler(context: HandlerContext): Handler<UnlikePostCommand, void> {
  return async ({ actorId, postId }) => {
    await context.database.transaction(async (transaction) => {
      if (await postRepository.removeLike(transaction, postId, actorId)) await postRepository.incrementCounter(transaction, postId, "likeCount", -1);
    });
  };
}
