import { CommandHandler } from "@zudojs/cqrs";

import { publishEvent } from "../../../../loaders/events.loader.js";
import { PostLikedEvent } from "../../events/postLiked.event.js";
import type { PostsService } from "../../services/posts.service.js";
import type { LikePostCommand } from "./likePost.command.js";

export class LikePostHandler extends CommandHandler<LikePostCommand, void> {
  public readonly commandType = "posts.likePost" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: LikePostCommand): Promise<void> {
    const { posts, interactions, clock, events } = this.postsService.dependencies;
    const userId = command.principal.userId;
    const post = await this.postsService.findVisiblePostOrThrow(command.postId, userId);
    await this.postsService.assertUsersAreNotBlocked(userId, post.authorId);
    if (!(await interactions.addLike(post.id, userId, clock.now()))) return;
    await posts.changeCounter(post.id, "likeCount", 1);
    await publishEvent(events, PostLikedEvent, { postId: post.id, userId, authorId: post.authorId });
    await this.postsService.notifyUserUnlessSelf(userId, {
      userId: post.authorId,
      category: "social",
      title: "New like",
      body: `${await this.postsService.findActorUsername(userId)} liked your ${post.kind}.`,
      data: { type: "like", postId: post.id },
    });
  }
}
