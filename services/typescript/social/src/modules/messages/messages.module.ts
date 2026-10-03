import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createReactToMessageHandler } from "./commands/reactToMessage/reactToMessage.handler.js";
import { createRemoveMessageReactionHandler } from "./commands/removeMessageReaction/removeMessageReaction.handler.js";
import { createReplyToStoryHandler } from "./commands/replyToStory/replyToStory.handler.js";
import { createSendMessageHandler } from "./commands/sendMessage/sendMessage.handler.js";
import { createShareToChatsHandler } from "./commands/shareToChats/shareToChats.handler.js";
import { createStopLiveLocationHandler } from "./commands/stopLiveLocation/stopLiveLocation.handler.js";
import { createUpdateLiveLocationHandler } from "./commands/updateLiveLocation/updateLiveLocation.handler.js";
import { createVoteOnPollHandler } from "./commands/voteOnPoll/voteOnPoll.handler.js";
import { createMessagesController } from "./controllers/messages.controller.js";
import { createGetSharedContentCardHandler } from "./queries/getSharedContentCard/getSharedContentCard.handler.js";
import { createListMessagesHandler } from "./queries/listMessages/listMessages.handler.js";
import { registerMessagesRoutes } from "./routes/messages.routes.js";

export function mountMessagesModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerMessagesRoutes(router, createMessagesController(route, {
    sendMessage: createSendMessageHandler(context),
    replyToStory: createReplyToStoryHandler(context),
    reactToMessage: createReactToMessageHandler(context),
    removeMessageReaction: createRemoveMessageReactionHandler(context),
    updateLiveLocation: createUpdateLiveLocationHandler(context),
    stopLiveLocation: createStopLiveLocationHandler(context),
    voteOnPoll: createVoteOnPollHandler(context),
    shareToChats: createShareToChatsHandler(context),
    listMessages: createListMessagesHandler(context),
    getSharedContentCard: createGetSharedContentCardHandler(context),
  }));
}
