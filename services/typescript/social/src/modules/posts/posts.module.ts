import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createCreatePostHandler } from "./commands/createPost/createPost.handler.js";
import { createDeletePostHandler } from "./commands/deletePost/deletePost.handler.js";
import { createLikePostHandler } from "./commands/likePost/likePost.handler.js";
import { createPinPostHandler } from "./commands/pinPost/pinPost.handler.js";
import { createMarkStorySeenHandler } from "./commands/markStorySeen/markStorySeen.handler.js";
import { createPublishStoryHandler } from "./commands/publishStory/publishStory.handler.js";
import { createResharePostHandler } from "./commands/resharePost/resharePost.handler.js";
import { createUndoRepostHandler } from "./commands/undoRepost/undoRepost.handler.js";
import { createRecordPostImpressionHandler } from "./commands/recordPostImpression/recordPostImpression.handler.js";
import { createRecordProfileVisitFromPostHandler } from "./commands/recordProfileVisitFromPost/recordProfileVisitFromPost.handler.js";
import { createGetPostAnalyticsHandler } from "./queries/getPostAnalytics/getPostAnalytics.handler.js";
import { createSharePostHandler } from "./commands/sharePost/sharePost.handler.js";
import { createUnlikePostHandler } from "./commands/unlikePost/unlikePost.handler.js";
import { createUnpinPostHandler } from "./commands/unpinPost/unpinPost.handler.js";
import { createPostsController } from "./controllers/posts.controller.js";
import { createGetPostHandler } from "./queries/getPost/getPost.handler.js";
import { createListStoryTrayHandler } from "./queries/listStoryTray/listStoryTray.handler.js";
import { createListUserPostsHandler } from "./queries/listUserPosts/listUserPosts.handler.js";
import { createListUserStoriesHandler } from "./queries/listUserStories/listUserStories.handler.js";
import { createListStoryViewersHandler } from "./queries/listStoryViewers/listStoryViewers.handler.js";
import { registerPostsRoutes } from "./routes/posts.routes.js";
import { createUpdatePostSensitivityHandler } from "./commands/updatePostSensitivity/updatePostSensitivity.handler.js";
import { createUpdateReplySettingsHandler } from "./commands/updateReplySettings/updateReplySettings.handler.js";
import { createPostAudienceController } from "./controllers/postAudience.controller.js";
import { createSetPostProductsHandler } from "./commands/setPostProducts/setPostProducts.handler.js";
import { createListPostQuotesHandler } from "./queries/listPostQuotes/listPostQuotes.handler.js";
import { createSetPostTagsHandler } from "./commands/setPostTags/setPostTags.handler.js";
import { createRemoveOwnPostTagHandler } from "./commands/removeOwnPostTag/removeOwnPostTag.handler.js";
import { createUpdateTaggingSettingsHandler } from "./commands/updateTaggingSettings/updateTaggingSettings.handler.js";
import { createGetTaggingSettingsHandler } from "./queries/getTaggingSettings/getTaggingSettings.handler.js";
import { createListPostTaggedUsersHandler } from "./queries/listPostTaggedUsers/listPostTaggedUsers.handler.js";
import { createListTagCandidatesHandler } from "./queries/listTagCandidates/listTagCandidates.handler.js";
import { createPostTagsController } from "./controllers/postTags.controller.js";
import { registerPostTagsRoutes } from "./routes/postTags.routes.js";
import { registerPostAudienceRoutes } from "./routes/postAudience.routes.js";
import { createPostNotificationMuteController } from "./controllers/postNotificationMute.controller.js";
import { registerPostNotificationMuteRoutes } from "./routes/postNotificationMute.routes.js";
import { createSetPostNotificationMuteHandler } from "./commands/setPostNotificationMute/setPostNotificationMute.handler.js";
import { createGetPostNotificationMuteHandler } from "./queries/getPostNotificationMute/getPostNotificationMute.handler.js";

export function mountPostsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  const deletePost = createDeletePostHandler(context);
  registerPostsRoutes(router, createPostsController(route, {
    createPost: createCreatePostHandler(context),
    recordPostImpression: createRecordPostImpressionHandler(context),
    recordProfileVisitFromPost: createRecordProfileVisitFromPostHandler(context),
    getPostAnalytics: createGetPostAnalyticsHandler(context),
    deletePost,
    resharePost: createResharePostHandler(context),
    undoRepost: createUndoRepostHandler(context, deletePost),
    likePost: createLikePostHandler(context),
    unlikePost: createUnlikePostHandler(context),
    pinPost: createPinPostHandler(context),
    unpinPost: createUnpinPostHandler(context),
    sharePost: createSharePostHandler(context),
    publishStory: createPublishStoryHandler(context),
    markStorySeen: createMarkStorySeenHandler(context),
    getPost: createGetPostHandler(context),
    listUserPosts: createListUserPostsHandler(context),
    listStoryTray: createListStoryTrayHandler(context),
    listUserStories: createListUserStoriesHandler(context),
    listStoryViewers: createListStoryViewersHandler(context),
  }));
  registerPostAudienceRoutes(router, createPostAudienceController(route, {
    updateReplySettings: createUpdateReplySettingsHandler(context),
    updatePostSensitivity: createUpdatePostSensitivityHandler(context),
    listPostQuotes: createListPostQuotesHandler(context),
    setPostProducts: createSetPostProductsHandler(context),
  }));
  registerPostNotificationMuteRoutes(router, createPostNotificationMuteController(route, {
    setPostNotificationMute: createSetPostNotificationMuteHandler(context),
    getPostNotificationMute: createGetPostNotificationMuteHandler(context),
  }));
  registerPostTagsRoutes(router, createPostTagsController(route, {
    setPostTags: createSetPostTagsHandler(context),
    removeOwnPostTag: createRemoveOwnPostTagHandler(context),
    listPostTaggedUsers: createListPostTaggedUsersHandler(context),
    listTagCandidates: createListTagCandidatesHandler(context),
    getTaggingSettings: createGetTaggingSettingsHandler(context),
    updateTaggingSettings: createUpdateTaggingSettingsHandler(context),
  }));
}
