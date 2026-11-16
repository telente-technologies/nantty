import { notFound, unprocessable } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { createStartDirectConversationHandler } from "../../../conversations/commands/startDirectConversation/startDirectConversation.handler.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import type { MessageView } from "../../models/message.model.js";
import { createSendMessageHandler } from "../sendMessage/sendMessage.handler.js";
import type { ReplyToStoryCommand } from "./replyToStory.command.js";

export function createReplyToStoryHandler(context: HandlerContext): Handler<ReplyToStoryCommand, MessageView> {
  const startConversation = createStartDirectConversationHandler(context);
  const sendMessage = createSendMessageHandler(context);
  return async ({ viewerId, storyId, encryption, idempotencyKey }) => {
    const story = await loadPostVisibleToViewer(context, viewerId, storyId);
    if (story.kind !== "story") throw notFound("STORY_NOT_FOUND", "Story not found.");
    if (story.authorId === viewerId) throw unprocessable("CANNOT_REPLY_TO_OWN_STORY", "You can't reply to your own story.");
    const conversation = await startConversation({ senderId: viewerId, peerId: story.authorId });
    return sendMessage({
      senderId: viewerId, conversationId: conversation.id, idempotencyKey, mentions: undefined,
      message: { kind: "shared", encryption, media: undefined, linkPreview: undefined },
    });
  };
}
