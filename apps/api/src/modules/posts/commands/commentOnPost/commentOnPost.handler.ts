import { CommandHandler } from "@zudojs/cqrs";

import { unprocessable } from "../../../../errors/domain.error.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import type { CommentDto } from "../../dtos/posts.dto.js";
import { PostCommentedEvent } from "../../events/postCommented.event.js";
import type { CommentRecord, PostRecord } from "../../models/posts.model.js";
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
    const parent = await this.findReplyTargetOrThrow(command.parentCommentId, post, userId);
    const rootCommentId = parent === undefined ? null : (parent.rootCommentId ?? parent.id);
    const comment = await interactions.createComment({
      postId: post.id,
      authorId: userId,
      parentCommentId: parent?.id ?? null,
      rootCommentId,
      text: command.text.trim(),
      createdAt: clock.now(),
    });
    await posts.changeCounter(post.id, "commentCount", 1);
    if (parent !== undefined && rootCommentId !== null) await interactions.changeReplyCount([parent.id, rootCommentId], 1);
    await publishEvent(events, PostCommentedEvent, { postId: post.id, commentId: comment.id, authorId: userId });
    await this.notifyPostAndCommentAuthors(userId, post, parent, comment);
    const [dto] = await this.postsService.commentPresenter.presentComments([comment], userId);
    return dto as CommentDto;
  }

  private async findReplyTargetOrThrow(parentCommentId: string | null, post: PostRecord, userId: string): Promise<CommentRecord | undefined> {
    if (parentCommentId === null) return undefined;
    const parent = await this.postsService.dependencies.interactions.findComment(parentCommentId);
    if (parent === undefined || parent.postId !== post.id || parent.deletedAt !== null) {
      throw unprocessable("The comment you are replying to does not exist.");
    }
    await this.postsService.assertUsersAreNotBlocked(userId, parent.authorId);
    return parent;
  }

  private async notifyPostAndCommentAuthors(userId: string, post: PostRecord, parent: CommentRecord | undefined, comment: CommentRecord): Promise<void> {
    const actor = await this.postsService.findActorUsername(userId);
    if (parent !== undefined) {
      await this.postsService.notifyUserUnlessSelf(userId, {
        userId: parent.authorId,
        category: "social",
        title: "New reply",
        body: `${actor} replied to your comment.`,
        data: { type: "reply", postId: post.id, commentId: comment.id, parentCommentId: parent.id },
      });
    }
    if (parent === undefined || parent.authorId !== post.authorId) {
      await this.postsService.notifyUserUnlessSelf(userId, {
        userId: post.authorId,
        category: "social",
        title: "New comment",
        body: `${actor} commented on your ${post.kind}.`,
        data: { type: "comment", postId: post.id, commentId: comment.id },
      });
    }
  }
}
