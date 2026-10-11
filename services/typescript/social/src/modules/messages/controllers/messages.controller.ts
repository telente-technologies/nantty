import type { Handler } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { ReactToMessageCommand } from "../commands/reactToMessage/reactToMessage.command.js";
import type { RemoveMessageReactionCommand } from "../commands/removeMessageReaction/removeMessageReaction.command.js";
import type { SendMessageCommand } from "../commands/sendMessage/sendMessage.command.js";
import type { ShareToChatsCommand } from "../commands/shareToChats/shareToChats.command.js";
import type { StopLiveLocationCommand } from "../commands/stopLiveLocation/stopLiveLocation.command.js";
import type { UpdateLiveLocationCommand } from "../commands/updateLiveLocation/updateLiveLocation.command.js";
import type { VoteOnPollCommand } from "../commands/voteOnPoll/voteOnPoll.command.js";
import type { MessageView, SharedContentCard } from "../models/message.model.js";
import type { GetSharedContentCardQuery } from "../queries/getSharedContentCard/getSharedContentCard.query.js";
import type { ListMessagesQuery } from "../queries/listMessages/listMessages.query.js";
import { storyReplyBodySchema, storyReplyParamsSchema, contentQuerySchema, conversationMessagesParamsSchema, listMessagesQuerySchema, locationBodySchema, messageParamsSchema, pollVoteBodySchema, reactionBodySchema, reactionParamsSchema, sendMessageBodySchema, shareBodySchema } from "../validators/messages.validator.js";

import type { ReplyToStoryCommand } from "../commands/replyToStory/replyToStory.command.js";

export interface MessagesHandlers {
  readonly replyToStory: Handler<ReplyToStoryCommand, MessageView>;
  readonly sendMessage: Handler<SendMessageCommand, MessageView>;
  readonly reactToMessage: Handler<ReactToMessageCommand, never>;
  readonly removeMessageReaction: Handler<RemoveMessageReactionCommand, never>;
  readonly updateLiveLocation: Handler<UpdateLiveLocationCommand, never>;
  readonly stopLiveLocation: Handler<StopLiveLocationCommand, never>;
  readonly voteOnPoll: Handler<VoteOnPollCommand, never>;
  readonly shareToChats: Handler<ShareToChatsCommand, { readonly sentCount: number; readonly shareCount: number }>;
  readonly listMessages: Handler<ListMessagesQuery, Page<MessageView>>;
  readonly getSharedContentCard: Handler<GetSharedContentCardQuery, SharedContentCard>;
}

export function createMessagesController(route: RouteFactory, handlers: MessagesHandlers) {
  const messageOnly = { authentication: "required", params: messageParamsSchema } as const;
  return {
    replyToStory: route({ authentication: "required", params: storyReplyParamsSchema, body: storyReplyBodySchema, successStatus: 201 }, ({ principal, params, body }) =>
      handlers.replyToStory({ viewerId: principal.accountId, storyId: params.storyId, encryption: body.encryption })),
    send: route({ authentication: "required", params: conversationMessagesParamsSchema, body: sendMessageBodySchema, successStatus: 201 }, ({ principal, params, body, idempotencyKey }) =>
      handlers.sendMessage({
        senderId: principal.accountId, conversationId: params.conversationId, idempotencyKey, mentions: body.mentions,
        message: {
          kind: body.kind ?? "text", encryption: body.encryption,
          media: body.mediaId === undefined ? undefined : { mediaId: body.mediaId, durationSeconds: body.durationSeconds },
          linkPreview: body.linkPreview,
          plaintext: { text: body.text, location: body.location, poll: body.poll, document: body.document, sharedContent: body.sharedContent },
        },
      })),
    list: route({ authentication: "required", params: conversationMessagesParamsSchema, query: listMessagesQuerySchema }, ({ principal, params, query }) =>
      handlers.listMessages({ viewerId: principal.accountId, conversationId: params.conversationId, cursor: query.cursor, after: query.after, limit: clampPageSize(query.limit, 30) })),
    react: route({ ...messageOnly, body: reactionBodySchema }, ({ principal, params, body }) => handlers.reactToMessage({ viewerId: principal.accountId, messageId: params.messageId, emoji: body.emoji })),
    unreact: route({ authentication: "required", params: reactionParamsSchema }, ({ principal, params }) => handlers.removeMessageReaction({ viewerId: principal.accountId, messageId: params.messageId, emoji: params.emoji })),
    updateLocation: route({ ...messageOnly, body: locationBodySchema }, ({ principal, params, body }) => handlers.updateLiveLocation({ viewerId: principal.accountId, messageId: params.messageId, latitude: body.latitude, longitude: body.longitude, address: body.address })),
    stopLocation: route(messageOnly, ({ principal, params }) => handlers.stopLiveLocation({ viewerId: principal.accountId, messageId: params.messageId })),
    vote: route({ ...messageOnly, body: pollVoteBodySchema }, ({ principal, params, body }) => handlers.voteOnPoll({ viewerId: principal.accountId, messageId: params.messageId, optionId: body.optionId })),
    share: route({ authentication: "required", body: shareBodySchema }, ({ principal, body }) =>
      handlers.shareToChats({ senderId: principal.accountId, conversationIds: body.conversationIds, reference: body.reference, encryptions: body.encryptions ?? [] })),
    content: route({ authentication: "required", query: contentQuerySchema }, ({ principal, query }) => handlers.getSharedContentCard({ viewerId: principal.accountId, reference: { kind: query.kind, id: query.id } })),
  };
}
