import { CommandHandler } from "@zudojs/cqrs";

import { forbidden } from "../../../../errors/domain.error.js";
import type { PostsService } from "../../services/posts.service.js";
import type { DeletePostCommand } from "./deletePost.command.js";

export class DeletePostHandler extends CommandHandler<DeletePostCommand, void> {
  public readonly commandType = "posts.deletePost" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: DeletePostCommand): Promise<void> {
    const { posts, clock } = this.postsService.dependencies;
    const post = await this.postsService.findVisiblePostOrThrow(command.postId, command.principal.userId);
    if (post.authorId !== command.principal.userId) throw forbidden("Only the author can delete this post.");
    await posts.markDeleted(post.id, clock.now());
    if (post.repostOfId !== null) await posts.changeCounter(post.repostOfId, "repostCount", -1);
  }
}
