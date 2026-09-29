import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { AddLiveProductHandler } from "./commands/addLiveProduct/addLiveProduct.handler.js";
import { CommentOnLiveSessionHandler } from "./commands/commentOnLiveSession/commentOnLiveSession.handler.js";
import { CommentOnPostHandler } from "./commands/commentOnPost/commentOnPost.handler.js";
import { CreatePostHandler } from "./commands/createPost/createPost.handler.js";
import { DeleteCommentHandler } from "./commands/deleteComment/deleteComment.handler.js";
import { DeletePostHandler } from "./commands/deletePost/deletePost.handler.js";
import { EndLiveSessionHandler } from "./commands/endLiveSession/endLiveSession.handler.js";
import { JoinLiveSessionHandler } from "./commands/joinLiveSession/joinLiveSession.handler.js";
import { LeaveLiveSessionHandler } from "./commands/leaveLiveSession/leaveLiveSession.handler.js";
import { LikePostHandler } from "./commands/likePost/likePost.handler.js";
import { RepostPostHandler } from "./commands/repostPost/repostPost.handler.js";
import { SharePostHandler } from "./commands/sharePost/sharePost.handler.js";
import { StartLiveSessionHandler } from "./commands/startLiveSession/startLiveSession.handler.js";
import { TagProductsHandler } from "./commands/tagProducts/tagProducts.handler.js";
import { UnlikePostHandler } from "./commands/unlikePost/unlikePost.handler.js";
import { GetLiveSessionHandler } from "./queries/getLiveSession/getLiveSession.handler.js";
import { GetPostHandler } from "./queries/getPost/getPost.handler.js";
import { ListActiveStoriesHandler } from "./queries/listActiveStories/listActiveStories.handler.js";
import { ListLiveCommentsHandler } from "./queries/listLiveComments/listLiveComments.handler.js";
import { ListLiveSessionsHandler } from "./queries/listLiveSessions/listLiveSessions.handler.js";
import { ListPostCommentsHandler } from "./queries/listPostComments/listPostComments.handler.js";
import { ListStorePostsHandler } from "./queries/listStorePosts/listStorePosts.handler.js";
import { ListUserPostsHandler } from "./queries/listUserPosts/listUserPosts.handler.js";
import type { PostsService } from "./services/posts.service.js";

export class PostsModule extends BaseModule {
  public readonly id = "posts";
  public readonly name = "posts";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("posts module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("posts module stopped");
  }
}

export function registerPostsCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, postsService: PostsService): void {
  registerCommandHandlers(commands, [
    new AddLiveProductHandler(postsService),
    new CommentOnLiveSessionHandler(postsService),
    new CommentOnPostHandler(postsService),
    new CreatePostHandler(postsService),
    new DeleteCommentHandler(postsService),
    new DeletePostHandler(postsService),
    new EndLiveSessionHandler(postsService),
    new JoinLiveSessionHandler(postsService),
    new LeaveLiveSessionHandler(postsService),
    new LikePostHandler(postsService),
    new RepostPostHandler(postsService),
    new SharePostHandler(postsService),
    new StartLiveSessionHandler(postsService),
    new TagProductsHandler(postsService),
    new UnlikePostHandler(postsService),
  ]);
  registerQueryHandlers(queries, [
    new GetLiveSessionHandler(postsService),
    new GetPostHandler(postsService),
    new ListActiveStoriesHandler(postsService),
    new ListLiveCommentsHandler(postsService),
    new ListLiveSessionsHandler(postsService),
    new ListPostCommentsHandler(postsService),
    new ListStorePostsHandler(postsService),
    new ListUserPostsHandler(postsService),
  ]);
}
