import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createCreateCommentHandler } from "./commands/createComment/createComment.handler.js";
import { createDeleteCommentHandler } from "./commands/deleteComment/deleteComment.handler.js";
import { createLikeCommentHandler } from "./commands/likeComment/likeComment.handler.js";
import { createPinCommentHandler } from "./commands/pinComment/pinComment.handler.js";
import { createUnlikeCommentHandler } from "./commands/unlikeComment/unlikeComment.handler.js";
import { createUnpinCommentHandler } from "./commands/unpinComment/unpinComment.handler.js";
import { createCommentsController } from "./controllers/comments.controller.js";
import { createGetCommentHandler } from "./queries/getComment/getComment.handler.js";
import { createGetCommentThreadHandler } from "./queries/getCommentThread/getCommentThread.handler.js";
import { createGetPostConversationHandler } from "./queries/getPostConversation/getPostConversation.handler.js";
import { createListCommentRepliesHandler } from "./queries/listCommentReplies/listCommentReplies.handler.js";
import { createListPostCommentsHandler } from "./queries/listPostComments/listPostComments.handler.js";
import { registerCommentsRoutes } from "./routes/comments.routes.js";

export function mountCommentsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerCommentsRoutes(router, createCommentsController(route, {
    createComment: createCreateCommentHandler(context),
    deleteComment: createDeleteCommentHandler(context),
    likeComment: createLikeCommentHandler(context),
    unlikeComment: createUnlikeCommentHandler(context),
    pinComment: createPinCommentHandler(context),
    unpinComment: createUnpinCommentHandler(context),
    listPostComments: createListPostCommentsHandler(context),
    listCommentReplies: createListCommentRepliesHandler(context),
    getComment: createGetCommentHandler(context),
    getCommentThread: createGetCommentThreadHandler(context),
    getPostConversation: createGetPostConversationHandler(context),
  }));
}
