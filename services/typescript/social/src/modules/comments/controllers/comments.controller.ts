import type { Handler } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { CreateCommentCommand } from "../commands/createComment/createComment.command.js";
import type { DeleteCommentCommand } from "../commands/deleteComment/deleteComment.command.js";
import type { LikeCommentCommand } from "../commands/likeComment/likeComment.command.js";
import type { PinCommentCommand } from "../commands/pinComment/pinComment.command.js";
import type { UnlikeCommentCommand } from "../commands/unlikeComment/unlikeComment.command.js";
import type { UnpinCommentCommand } from "../commands/unpinComment/unpinComment.command.js";
import type { CommentThreadPage, CommentView } from "../models/comment.model.js";
import type { ConversationItem } from "../queries/getPostConversation/getPostConversation.handler.js";
import type { PostCommentsItem } from "../queries/listPostComments/listPostComments.handler.js";
import type { GetCommentThreadQuery } from "../queries/getCommentThread/getCommentThread.query.js";
import type { GetPostConversationQuery } from "../queries/getPostConversation/getPostConversation.query.js";
import type { GetCommentQuery } from "../queries/getComment/getComment.query.js";
import type { ListCommentRepliesQuery } from "../queries/listCommentReplies/listCommentReplies.query.js";
import type { ListPostCommentsQuery } from "../queries/listPostComments/listPostComments.query.js";
import { commentParamsSchema, commentsPageQuerySchema, conversationQuerySchema, newCommentBodySchema, postCommentParamsSchema, postCommentsParamsSchema, rankedCommentsQuerySchema } from "../validators/comments.validator.js";

export interface CommentsHandlers {
  readonly createComment: Handler<CreateCommentCommand, CommentView>;
  readonly deleteComment: Handler<DeleteCommentCommand, void>;
  readonly likeComment: Handler<LikeCommentCommand, void>;
  readonly unlikeComment: Handler<UnlikeCommentCommand, void>;
  readonly pinComment: Handler<PinCommentCommand, CommentView>;
  readonly unpinComment: Handler<UnpinCommentCommand, void>;
  readonly listPostComments: Handler<ListPostCommentsQuery, Page<PostCommentsItem>>;
  readonly listCommentReplies: Handler<ListCommentRepliesQuery, Page<CommentView>>;
  readonly getComment: Handler<GetCommentQuery, CommentView>;
  readonly getCommentThread: Handler<GetCommentThreadQuery, CommentThreadPage>;
  readonly getPostConversation: Handler<GetPostConversationQuery, Page<ConversationItem>>;
}

export function createCommentsController(route: RouteFactory, handlers: CommentsHandlers) {
  return {
    createComment: route({ authentication: "required", params: postCommentsParamsSchema, body: newCommentBodySchema, successStatus: 201 }, ({ principal, params, body }) =>
      handlers.createComment({ authorId: principal.accountId, postId: params.postId, text: body.text, parentCommentId: body.parentCommentId, mentions: body.mentions, quotedPostId: body.quotedPostId })),
    listPostComments: route({ authentication: "optional", params: postCommentsParamsSchema, query: rankedCommentsQuerySchema }, ({ principal, params, query }) =>
      handlers.listPostComments({ viewerId: principal?.accountId, postId: params.postId, filter: query.filter, cursor: query.cursor, limit: clampPageSize(query.limit, 20) })),
    listCommentReplies: route({ authentication: "optional", params: commentParamsSchema, query: commentsPageQuerySchema }, ({ principal, params, query }) =>
      handlers.listCommentReplies({ viewerId: principal?.accountId, commentId: params.commentId, cursor: query.cursor, limit: clampPageSize(query.limit, 20) })),
    getPostConversation: route({ authentication: "optional", params: postCommentsParamsSchema, query: conversationQuerySchema }, ({ principal, params, query }) =>
      handlers.getPostConversation({ viewerId: principal?.accountId, postId: params.postId, sort: query.sort ?? "relevant", filter: query.filter, cursor: query.cursor, limit: clampPageSize(query.limit, 10) })),
    getCommentThread: route({ authentication: "optional", params: commentParamsSchema, query: commentsPageQuerySchema }, ({ principal, params, query }) =>
      handlers.getCommentThread({ viewerId: principal?.accountId, commentId: params.commentId, cursor: query.cursor, limit: clampPageSize(query.limit, 10) })),
    getComment: route({ authentication: "optional", params: commentParamsSchema }, ({ principal, params }) => handlers.getComment({ viewerId: principal?.accountId, commentId: params.commentId })),
    deleteComment: route({ authentication: "required", params: commentParamsSchema }, ({ principal, params }) => handlers.deleteComment({ actorId: principal.accountId, commentId: params.commentId })),
    likeComment: route({ authentication: "required", params: commentParamsSchema }, ({ principal, params }) => handlers.likeComment({ actorId: principal.accountId, commentId: params.commentId })),
    unlikeComment: route({ authentication: "required", params: commentParamsSchema }, ({ principal, params }) => handlers.unlikeComment({ actorId: principal.accountId, commentId: params.commentId })),
    pinComment: route({ authentication: "required", params: postCommentParamsSchema }, ({ principal, params }) => handlers.pinComment({ actorId: principal.accountId, postId: params.postId, commentId: params.commentId })),
    unpinComment: route({ authentication: "required", params: postCommentParamsSchema }, ({ principal, params }) => handlers.unpinComment({ actorId: principal.accountId, postId: params.postId, commentId: params.commentId })),
  };
}
