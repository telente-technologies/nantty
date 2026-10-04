import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postRepository } from "../../../posts/repositories/post.repository.js";
import type { LinkPreviewView } from "../../models/linkPreview.model.js";
import type { RefreshPostLinkPreviewCommand } from "./refreshPostLinkPreview.command.js";

export function createRefreshPostLinkPreviewHandler(context: HandlerContext): Handler<RefreshPostLinkPreviewCommand, LinkPreviewView | null> {
  return async (command) => {
    const post = await postRepository.findById(context.database.client, command.postId);
    if (post === null || post.deletedAt !== null) throw notFound("POST_NOT_FOUND", "Post not found.");
    if (post.media.length > 0 || post.visibility === "subscribers") return null;
    if (post.linkPreview !== null) return post.linkPreview as unknown as LinkPreviewView;
    return context.linkPreviews === undefined ? null : context.linkPreviews.attachLinkPreviewToPost(post.id, post.text);
  };
}
