import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postRepository } from "../../repositories/post.repository.js";
import { loadPostVisibleToViewer } from "../../services/postAccess.service.js";
import type { MarkStorySeenCommand } from "./markStorySeen.command.js";

export function createMarkStorySeenHandler(context: HandlerContext): Handler<MarkStorySeenCommand, void> {
  return async ({ viewerId, storyId }) => {
    await loadPostVisibleToViewer(context, viewerId, storyId);
    await postRepository.markStoryViewed(context.database.client, storyId, viewerId);
  };
}
