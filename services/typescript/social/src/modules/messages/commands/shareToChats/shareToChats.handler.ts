import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postRepository } from "../../../posts/repositories/post.repository.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import { messageRepository } from "../../repositories/message.repository.js";
import { createSendMessageHandler } from "../sendMessage/sendMessage.handler.js";
import type { ShareToChatsCommand } from "./shareToChats.command.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createShareToChatsHandler(context: HandlerContext): Handler<ShareToChatsCommand, { readonly sentCount: number; readonly shareCount: number }> {
  const sendMessage = createSendMessageHandler(context);
  return async ({ senderId, conversationIds, reference, encryptions }) => {
    const isPost = (reference.kind === "post" || reference.kind === "clip") && uuidPattern.test(reference.id);
    if (isPost) await loadPostVisibleToViewer(context, senderId, reference.id);
    let sentCount = 0;
    for (const conversationId of new Set(conversationIds)) {
      const envelope = encryptions.find((candidate) => candidate.conversationId === conversationId);
      await sendMessage({
        senderId, conversationId, idempotencyKey: undefined, mentions: undefined,
        message: {
          kind: "shared", text: undefined, media: undefined, linkPreview: undefined, location: undefined, document: undefined, poll: undefined, sharedContent: reference,
          encryption: envelope === undefined ? undefined : { deviceId: envelope.deviceId, ciphertext: envelope.ciphertext, protocol: undefined },
        },
      });
      sentCount += 1;
    }
    if (isPost && sentCount > 0) {
      await context.database.transaction(async (transaction) => {
        await postRepository.incrementCounter(transaction, reference.id, "shareCount", sentCount);
        await postRepository.recordShare(transaction, reference.id, senderId, "chat");
      });
      const post = await postRepository.findById(context.database.client, reference.id);
      return { sentCount, shareCount: post?.shareCount ?? sentCount };
    }
    return { sentCount, shareCount: await messageRepository.countSharesOfReference(context.database.client, reference.kind, reference.id) };
  };
}
