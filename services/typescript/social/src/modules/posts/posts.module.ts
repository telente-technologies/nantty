import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createCreatePostHandler } from "./commands/createPost/createPost.handler.js";
import { createDeletePostHandler } from "./commands/deletePost/deletePost.handler.js";
import { createLikePostHandler } from "./commands/likePost/likePost.handler.js";
import { createMarkStorySeenHandler } from "./commands/markStorySeen/markStorySeen.handler.js";
import { createPublishStoryHandler } from "./commands/publishStory/publishStory.handler.js";
import { createResharePostHandler } from "./commands/resharePost/resharePost.handler.js";
import { createRecordPostImpressionHandler } from "./commands/recordPostImpression/recordPostImpression.handler.js";
import { createRecordProfileVisitFromPostHandler } from "./commands/recordProfileVisitFromPost/recordProfileVisitFromPost.handler.js";
import { createGetPostAnalyticsHandler } from "./queries/getPostAnalytics/getPostAnalytics.handler.js";
import { createSharePostHandler } from "./commands/sharePost/sharePost.handler.js";
import { createUnlikePostHandler } from "./commands/unlikePost/unlikePost.handler.js";
import { createPostsController } from "./controllers/posts.controller.js";
import { createGetPostHandler } from "./queries/getPost/getPost.handler.js";
import { createListStoryTrayHandler } from "./queries/listStoryTray/listStoryTray.handler.js";
import { createListUserPostsHandler } from "./queries/listUserPosts/listUserPosts.handler.js";
import { createListUserStoriesHandler } from "./queries/listUserStories/listUserStories.handler.js";
import { registerPostsRoutes } from "./routes/posts.routes.js";
import { createUpdatePostSensitivityHandler } from "./commands/updatePostSensitivity/updatePostSensitivity.handler.js";
import { createUpdateReplySettingsHandler } from "./commands/updateReplySettings/updateReplySettings.handler.js";
import { createPostAudienceController } from "./controllers/postAudience.controller.js";
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

export function mountPostsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerPostsRoutes(router, createPostsController(route, {
    createPost: createCreatePostHandler(context),
    recordPostImpression: createRecordPostImpressionHandler(context),
    recordProfileVisitFromPost: createRecordProfileVisitFromPostHandler(context),
    getPostAnalytics: createGetPostAnalyticsHandler(context),
    deletePost: createDeletePostHandler(context),
    resharePost: createResharePostHandler(context),
    likePost: createLikePostHandler(context),
    unlikePost: createUnlikePostHandler(context),
    sharePost: createSharePostHandler(context),
    publishStory: createPublishStoryHandler(context),
    markStorySeen: createMarkStorySeenHandler(context),
    getPost: createGetPostHandler(context),
    listUserPosts: createListUserPostsHandler(context),
    listStoryTray: createListStoryTrayHandler(context),
    listUserStories: createListUserStoriesHandler(context),
  }));
  registerPostAudienceRoutes(router, createPostAudienceController(route, {
    updateReplySettings: createUpdateReplySettingsHandler(context),
    updatePostSensitivity: createUpdatePostSensitivityHandler(context),
    listPostQuotes: createListPostQuotesHandler(context),
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
