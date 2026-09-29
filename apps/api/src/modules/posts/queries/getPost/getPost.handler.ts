import { QueryHandler } from "@zudojs/cqrs";

import type { PostDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { GetPostQuery } from "./getPost.query.js";

export class GetPostHandler extends QueryHandler<GetPostQuery, PostDto> {
  public readonly queryType = "posts.getPost" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(query: GetPostQuery): Promise<PostDto> {
    const post = await this.postsService.findVisiblePostOrThrow(query.postId, query.viewerId);
    const [dto] = await this.postsService.presenter.presentPosts([post], query.viewerId, query.displayCurrency);
    return dto as PostDto;
  }
}
