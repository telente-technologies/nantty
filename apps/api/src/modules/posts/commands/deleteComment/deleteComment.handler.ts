import { CommandHandler } from "@zudojs/cqrs";

import { forbidden, notFound } from "../../../../errors/domain.error.js";
import type { CommentRecord } from "../../models/posts.model.js";
import type { PostsService } from "../../services/posts.service.js";
import type { DeleteCommentCommand } from "./deleteComment.command.js";

export class DeleteCommentHandler extends CommandHandler<DeleteCommentCommand, void> {
  public readonly commandType = "posts.deleteComment" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: DeleteCommentCommand): Promise<void> {
    const { posts, interactions, clock } = this.postsService.dependencies;
    const userId = command.principal.userId;
    const { comment, post } = await this.postsService.findCommentOnVisiblePostOrThrow(command.commentId, userId);
    if (comment.deletedAt !== null || (command.expectedPostId !== null && comment.postId !== command.expectedPostId)) throw notFound("Comment");
    if (comment.authorId !== userId && post.authorId !== userId) throw forbidden("You cannot delete this comment.");
    if (!(await interactions.markCommentDeleted(comment.id, clock.now()))) return;
    await posts.changeCounter(post.id, "commentCount", -1);
    if (comment.replyCount === 0) await this.removeVanishedCommentFromReplyCounts(comment);
  }

  private async removeVanishedCommentFromReplyCounts(vanishedComment: CommentRecord): Promise<void> {
    const { interactions } = this.postsService.dependencies;
    let vanished: CommentRecord | undefined = vanishedComment;
    while (vanished?.parentCommentId != null) {
      const parentCommentId: string = vanished.parentCommentId;
      await interactions.changeReplyCount([parentCommentId, vanished.rootCommentId ?? parentCommentId], -1);
      const parent = await interactions.findComment(parentCommentId);
      vanished = parent !== undefined && parent.deletedAt !== null && parent.replyCount === 0 ? parent : undefined;
    }
  }
}
