import { CommandHandler } from "@zudojs/cqrs";

import { forbidden, notFound } from "../../../../errors/domain.error.js";
import type { PostDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { TagProductsCommand } from "./tagProducts.command.js";

export class TagProductsHandler extends CommandHandler<TagProductsCommand, PostDto> {
  public readonly commandType = "posts.tagProducts" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: TagProductsCommand): Promise<PostDto> {
    const userId = command.principal.userId;
    const post = await this.postsService.findVisiblePostOrThrow(command.postId, userId);
    if (post.authorId !== userId) throw forbidden("Only the author can tag products on this post.");
    await this.postsService.findPublishedProductsOrThrow(command.productIds);
    const updated = await this.postsService.dependencies.posts.addTaggedProducts(post.id, command.productIds);
    if (updated === undefined) throw notFound("Post");
    const [dto] = await this.postsService.presenter.presentPosts([updated], userId, command.displayCurrency);
    return dto as PostDto;
  }
}
