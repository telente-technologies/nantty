import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { PostView } from "../../models/post.model.js";
import { loadPostVisibleToViewer } from "../../services/postAccess.service.js";
import { buildPostViews } from "../../services/postView.service.js";
import type { GetPostQuery } from "./getPost.query.js";

export function createGetPostHandler(context: HandlerContext): Handler<GetPostQuery, PostView> {
  return async ({ viewerId, postId }) => {
    const row = await loadPostVisibleToViewer(context, viewerId, postId);
    const [view] = await buildPostViews(context, viewerId, [row]);
    return view as PostView;
  };
}
