import { CommandHandler } from "@zudojs/cqrs";

import type { PostsService } from "../../services/posts.service.js";
import type { SharePostCommand } from "./sharePost.command.js";

export class SharePostHandler extends CommandHandler<SharePostCommand, { readonly shares: number }> {
  public readonly commandType = "posts.sharePost" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: SharePostCommand): Promise<{ readonly shares: number }> {
    const { posts } = this.postsService.dependencies;
    const post = await this.postsService.findVisiblePostOrThrow(command.postId, command.principal.userId);
    await posts.changeCounter(post.id, "shareCount", 1);
    return { shares: (await posts.findById(post.id))?.shareCount ?? post.shareCount + 1 };
  }
}
