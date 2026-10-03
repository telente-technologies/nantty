import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { loadPostVisibleToViewer } from "../../services/postAccess.service.js";
import type { RecordProfileVisitFromPostCommand } from "./recordProfileVisitFromPost.command.js";

export function createRecordProfileVisitFromPostHandler(context: HandlerContext): Handler<RecordProfileVisitFromPostCommand, void> {
  return async ({ viewerId, postId }) => {
    const post = await loadPostVisibleToViewer(context, viewerId, postId);
    if (viewerId === post.authorId) return;
    await context.database.client.post.update({ where: { id: postId }, data: { profileVisitCount: { increment: 1 } } });
  };
}
