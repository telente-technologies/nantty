import type { Handler } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { CreatePostCommand } from "../commands/createPost/createPost.command.js";
import type { DeletePostCommand } from "../commands/deletePost/deletePost.command.js";
import type { LikePostCommand } from "../commands/likePost/likePost.command.js";
import type { MarkStorySeenCommand } from "../commands/markStorySeen/markStorySeen.command.js";
import type { PublishStoryCommand } from "../commands/publishStory/publishStory.command.js";
import type { ResharePostCommand } from "../commands/resharePost/resharePost.command.js";
import type { SharePostCommand } from "../commands/sharePost/sharePost.command.js";
import type { UnlikePostCommand } from "../commands/unlikePost/unlikePost.command.js";
import type { PostView, StoryView } from "../models/post.model.js";
import type { GetPostQuery } from "../queries/getPost/getPost.query.js";
import type { StoryTrayItem } from "../queries/listStoryTray/listStoryTray.handler.js";
import type { ListStoryTrayQuery } from "../queries/listStoryTray/listStoryTray.query.js";
import type { ListUserPostsQuery } from "../queries/listUserPosts/listUserPosts.query.js";
import type { ListUserStoriesQuery } from "../queries/listUserStories/listUserStories.query.js";
import { createPostBodySchema, postIdParamsSchema, publishStoryBodySchema, repostBodySchema, shareBodySchema, storyIdParamsSchema, userIdParamsSchema, userPostsQuerySchema } from "../validators/posts.validator.js";

import type { RecordPostImpressionCommand } from "../commands/recordPostImpression/recordPostImpression.command.js";
import type { RecordProfileVisitFromPostCommand } from "../commands/recordProfileVisitFromPost/recordProfileVisitFromPost.command.js";
import type { PostAnalyticsView } from "../queries/getPostAnalytics/getPostAnalytics.handler.js";
import type { GetPostAnalyticsQuery } from "../queries/getPostAnalytics/getPostAnalytics.query.js";

export interface PostsHandlers {
  readonly recordPostImpression: Handler<RecordPostImpressionCommand, void>;
  readonly recordProfileVisitFromPost: Handler<RecordProfileVisitFromPostCommand, void>;
  readonly getPostAnalytics: Handler<GetPostAnalyticsQuery, PostAnalyticsView>;
  readonly createPost: Handler<CreatePostCommand, PostView>;
  readonly deletePost: Handler<DeletePostCommand, void>;
  readonly resharePost: Handler<ResharePostCommand, PostView>;
  readonly likePost: Handler<LikePostCommand, void>;
  readonly unlikePost: Handler<UnlikePostCommand, void>;
  readonly sharePost: Handler<SharePostCommand, void>;
  readonly publishStory: Handler<PublishStoryCommand, StoryView>;
  readonly markStorySeen: Handler<MarkStorySeenCommand, void>;
  readonly getPost: Handler<GetPostQuery, PostView>;
  readonly listUserPosts: Handler<ListUserPostsQuery, Page<PostView>>;
  readonly listStoryTray: Handler<ListStoryTrayQuery, StoryTrayItem[]>;
  readonly listUserStories: Handler<ListUserStoriesQuery, StoryView[]>;
}

export function createPostsController(route: RouteFactory, handlers: PostsHandlers) {
  return {
    recordImpression: route({ authentication: "optional", params: postIdParamsSchema }, ({ principal, params }) => handlers.recordPostImpression({ viewerId: principal?.accountId, postId: params.postId })),
    recordProfileVisit: route({ authentication: "optional", params: postIdParamsSchema }, ({ principal, params }) => handlers.recordProfileVisitFromPost({ viewerId: principal?.accountId, postId: params.postId })),
    analytics: route({ authentication: "required", params: postIdParamsSchema }, ({ principal, params }) => handlers.getPostAnalytics({ viewerId: principal.accountId, postId: params.postId })),
    createPost: route({ authentication: "required", body: createPostBodySchema, successStatus: 201 }, ({ principal, body }) =>
      handlers.createPost({
        authorId: principal.accountId,
        kind: body.kind ?? "post",
        text: body.text ?? "",
        mediaIds: body.mediaIds ?? [],
        media: body.media ?? [],
        audience: body.audience ?? "everyone",
        visibility: body.visibility ?? "public",
        isAiGenerated: body.isAiGenerated ?? false,
        soundId: body.soundId,
        mentions: body.mentions,
        replyToComment: body.replyToComment,
        stickerLayout: body.stickerLayout,
        replyPolicy: body.replyPolicy,
        sensitiveLabels: body.sensitiveLabels,
        taggedUserIds: body.taggedUserIds,
      })),
    getPost: route({ authentication: "optional", params: postIdParamsSchema }, ({ principal, params }) => handlers.getPost({ viewerId: principal?.accountId, postId: params.postId })),
    deletePost: route({ authentication: "required", params: postIdParamsSchema }, ({ principal, params }) => handlers.deletePost({ actorId: principal.accountId, postId: params.postId })),
    likePost: route({ authentication: "required", params: postIdParamsSchema }, ({ principal, params }) => handlers.likePost({ actorId: principal.accountId, postId: params.postId })),
    unlikePost: route({ authentication: "required", params: postIdParamsSchema }, ({ principal, params }) => handlers.unlikePost({ actorId: principal.accountId, postId: params.postId })),
    sharePost: route({ authentication: "optional", params: postIdParamsSchema, body: shareBodySchema }, ({ principal, params, body }) => handlers.sharePost({ actorId: principal?.accountId, postId: params.postId, channel: body?.channel ?? "link" })),
    resharePost: route({ authentication: "required", params: postIdParamsSchema, body: repostBodySchema, successStatus: 201 }, ({ principal, params, body }) => handlers.resharePost({ actorId: principal.accountId, postId: params.postId, text: body?.text ?? "" })),
    listUserPosts: route({ authentication: "optional", params: userIdParamsSchema, query: userPostsQuerySchema }, ({ principal, params, query }) =>
      handlers.listUserPosts({ viewerId: principal?.accountId, ownerId: params.userId === "me" ? (principal?.accountId ?? params.userId) : params.userId, cursor: query.cursor, limit: clampPageSize(query.limit), kind: query.kind })),
    publishStory: route({ authentication: "required", body: publishStoryBodySchema, successStatus: 201 }, ({ principal, body }) => handlers.publishStory({ authorId: principal.accountId, mediaId: body.mediaId, media: body.media })),
    markStorySeen: route({ authentication: "required", params: storyIdParamsSchema }, ({ principal, params }) => handlers.markStorySeen({ viewerId: principal.accountId, storyId: params.storyId })),
    listStoryTray: route({ authentication: "required" }, ({ principal }) => handlers.listStoryTray({ viewerId: principal.accountId })),
    listUserStories: route({ authentication: "optional", params: userIdParamsSchema }, ({ principal, params }) =>
      handlers.listUserStories({ viewerId: principal?.accountId, ownerId: params.userId === "me" ? (principal?.accountId ?? params.userId) : params.userId })),
  };
}
