import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { commentRepository } from "../../repositories/comment.repository.js";
import type { UnlikeCommentCommand } from "./unlikeComment.command.js";

export function createUnlikeCommentHandler(context: HandlerContext): Handler<UnlikeCommentCommand, void> {
  return async ({ actorId, commentId }) => {
    await context.database.transaction(async (transaction) => {
      if (await commentRepository.removeLike(transaction, commentId, actorId)) await transaction.comment.update({ where: { id: commentId }, data: { likeCount: { increment: -1 } } });
    });
  };
}
