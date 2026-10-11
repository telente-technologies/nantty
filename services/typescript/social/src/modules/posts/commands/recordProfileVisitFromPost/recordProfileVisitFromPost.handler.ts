import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { loadPostVisibleToViewer } from "../../services/postAccess.service.js";
import { claimViewerCooldown } from "../../services/postViewerCounters.service.js";
import type { RecordProfileVisitFromPostCommand } from "./recordProfileVisitFromPost.command.js";

export function createRecordProfileVisitFromPostHandler(context: HandlerContext): Handler<RecordProfileVisitFromPostCommand, void> {
  return async ({ viewerId, postId }) => {
    const post = await loadPostVisibleToViewer(context, viewerId, postId);
    if (viewerId === undefined || viewerId === post.authorId) return;
    const now = context.clock.now();
    await context.database.transaction(async (transaction) => {
      if (await claimViewerCooldown(transaction, postId, viewerId, "lastProfileClickAt", now)) await transaction.post.update({ where: { id: postId }, data: { profileVisitCount: { increment: 1 } } });
    });
  };
}
