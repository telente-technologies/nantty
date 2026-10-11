import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import type { LinkPreviewView } from "../../models/linkPreview.model.js";
import type { RefreshPostLinkPreviewCommand } from "./refreshPostLinkPreview.command.js";

export function createRefreshPostLinkPreviewHandler(context: HandlerContext): Handler<RefreshPostLinkPreviewCommand, LinkPreviewView | null> {
  return async (command) => {
    const post = await loadPostVisibleToViewer(context, command.actorId, command.postId);
    if (post.media.length > 0 || post.visibility === "subscribers") return null;
    if (post.linkPreview !== null) return post.linkPreview as unknown as LinkPreviewView;
    return context.linkPreviews === undefined ? null : context.linkPreviews.attachLinkPreviewToPost(post.id, post.text);
  };
}
