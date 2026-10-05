import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { StoryView } from "../../models/post.model.js";
import { postRepository } from "../../repositories/post.repository.js";
import { buildStoryViews } from "../../services/storyView.service.js";
import { createCreatePostHandler } from "../createPost/createPost.handler.js";
import type { PublishStoryCommand } from "./publishStory.command.js";

export function createPublishStoryHandler(context: HandlerContext): Handler<PublishStoryCommand, StoryView> {
  const createPost = createCreatePostHandler(context);
  return async ({ authorId, mediaId }) => {
    const view = await createPost({
      authorId, kind: "story", text: "", mediaIds: [mediaId], audience: "everyone", visibility: "public",
      isAiGenerated: false, soundId: undefined, mentions: undefined, replyToComment: undefined, stickerLayout: undefined,
    });
    const row = await postRepository.findById(context.database.client, view.id);
    const [story] = await buildStoryViews(context, authorId, row === null ? [] : [row]);
    return story as StoryView;
  };
}
