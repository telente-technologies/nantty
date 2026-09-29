import { CommandHandler } from "@zudojs/cqrs";

import type { PostsService } from "../../services/posts.service.js";
import type { UnlikePostCommand } from "./unlikePost.command.js";

export class UnlikePostHandler extends CommandHandler<UnlikePostCommand, void> {
  public readonly commandType = "posts.unlikePost" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: UnlikePostCommand): Promise<void> {
    const { posts, interactions } = this.postsService.dependencies;
    const post = await this.postsService.findVisiblePostOrThrow(command.postId, command.principal.userId);
    if (await interactions.removeLike(post.id, command.principal.userId)) await posts.changeCounter(post.id, "likeCount", -1);
  }
}
