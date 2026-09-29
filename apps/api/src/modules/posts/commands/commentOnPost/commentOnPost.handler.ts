import { CommandHandler } from "@zudojs/cqrs";

import { unprocessable } from "../../../../errors/domain.error.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import type { CommentDto } from "../../dtos/posts.dto.js";
import { PostCommentedEvent } from "../../events/postCommented.event.js";
import type { PostsService } from "../../services/posts.service.js";
import type { CommentOnPostCommand } from "./commentOnPost.command.js";

export class CommentOnPostHandler extends CommandHandler<CommentOnPostCommand, CommentDto> {
  public readonly commandType = "posts.commentOnPost" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: CommentOnPostCommand): Promise<CommentDto> {
    const { posts, interactions, clock, events } = this.postsService.dependencies;
    const userId = command.principal.userId;
    const post = await this.postsService.findVisiblePostOrThrow(command.postId, userId);
    await this.postsService.assertUsersAreNotBlocked(userId, post.authorId);
    const parent = command.parentId === null ? undefined : await interactions.findComment(command.parentId);
    if (command.parentId !== null && (parent === undefined || parent.postId !== post.id || parent.deletedAt !== null)) {
      throw unprocessable("The comment you are replying to does not exist.");
    }
    const comment = await interactions.createComment({
      postId: post.id,
      authorId: userId,
      parentId: parent?.id ?? null,
      text: command.text.trim(),
      createdAt: clock.now(),
    });
    await posts.changeCounter(post.id, "commentCount", 1);
    await publishEvent(events, PostCommentedEvent, { postId: post.id, commentId: comment.id, authorId: userId });
    const actor = await this.postsService.findActorUsername(userId);
    await this.postsService.notifyUserUnlessSelf(userId, {
      userId: post.authorId,
      category: "social",
      title: "New comment",
      body: `${actor} commented on your ${post.kind}.`,
      data: { type: "comment", postId: post.id, commentId: comment.id },
    });
    if (parent !== undefined && parent.authorId !== post.authorId) {
      await this.postsService.notifyUserUnlessSelf(userId, {
        userId: parent.authorId,
        category: "social",
        title: "New reply",
        body: `${actor} replied to your comment.`,
        data: { type: "reply", postId: post.id, commentId: comment.id },
      });
    }
    const [dto] = await this.postsService.presenter.presentComments([comment], userId);
    return dto as CommentDto;
  }
}
