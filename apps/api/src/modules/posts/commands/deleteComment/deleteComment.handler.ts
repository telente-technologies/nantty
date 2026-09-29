import { CommandHandler } from "@zudojs/cqrs";

import { forbidden, notFound } from "../../../../errors/domain.error.js";
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
    const post = await this.postsService.findVisiblePostOrThrow(command.postId, userId);
    const comment = await interactions.findComment(command.commentId);
    if (comment === undefined || comment.postId !== post.id || comment.deletedAt !== null) throw notFound("Comment");
    if (comment.authorId !== userId && post.authorId !== userId) throw forbidden("You cannot delete this comment.");
    if (await interactions.markCommentDeleted(comment.id, clock.now())) await posts.changeCounter(post.id, "commentCount", -1);
  }
}
