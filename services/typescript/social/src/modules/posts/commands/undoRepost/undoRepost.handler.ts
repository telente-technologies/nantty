import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { DeletePostCommand } from "../deletePost/deletePost.command.js";
import { postRepository } from "../../repositories/post.repository.js";
import { quoteOriginalIdFor } from "../../services/quoteTarget.service.js";
import type { UndoRepostCommand } from "./undoRepost.command.js";

export function createUndoRepostHandler(context: HandlerContext, deletePost: Handler<DeletePostCommand, void>): Handler<UndoRepostCommand, void> {
  return async ({ actorId, postId }) => {
    const db = context.database.client;
    const target = await postRepository.findByIdIncludingHidden(db, postId);
    if (target === null) return;
    const repost = await postRepository.findPlainRepost(db, actorId, quoteOriginalIdFor(target));
    if (repost !== null) await deletePost({ actorId, postId: repost.id });
  };
}
