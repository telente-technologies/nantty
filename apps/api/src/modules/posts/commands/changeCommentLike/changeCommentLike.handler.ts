import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { PostsService } from "../../services/posts.service.js";
import type { ChangeCommentLikeCommand } from "./changeCommentLike.command.js";

export class ChangeCommentLikeHandler extends CommandHandler<ChangeCommentLikeCommand, { readonly liked: boolean; readonly likes: number }> {
  public readonly commandType = "posts.changeCommentLike" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: ChangeCommentLikeCommand): Promise<{ readonly liked: boolean; readonly likes: number }> {
    const { interactions, engagement } = this.postsService.dependencies;
    const userId = command.principal.userId;
    const comment = await interactions.findComment(command.commentId);
    if (comment === undefined || comment.deletedAt !== null) throw notFound("Comment");
    await this.postsService.findVisiblePostOrThrow(comment.postId, userId);
    await this.postsService.assertUsersAreNotBlocked(userId, comment.authorId);
    if (command.liked) {
      await engagement.likeComment(comment.id, userId);
    } else {
      await engagement.unlikeComment(comment.id, userId);
    }
    const likes = (await engagement.countLikesForComments([comment.id])).get(comment.id) ?? 0;
    return { liked: command.liked, likes };
  }
}
