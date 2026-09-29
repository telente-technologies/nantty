import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { Page } from "../../../../types/pagination.type.js";
import type { PostDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { ListUserPostsQuery } from "./listUserPosts.query.js";

export class ListUserPostsHandler extends QueryHandler<ListUserPostsQuery, Page<PostDto>> {
  public readonly queryType = "posts.listUserPosts" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(query: ListUserPostsQuery): Promise<Page<PostDto>> {
    const { posts, clock, socialGraph } = this.postsService.dependencies;
    if (query.viewerId !== undefined && query.viewerId !== query.authorId && (await socialGraph.isBlockedEitherWay(query.viewerId, query.authorId))) {
      throw notFound("User");
    }
    const kinds = query.kind === undefined ? (["post", "clip"] as const) : [query.kind];
    const page = await posts.listVisible({ authorIds: [query.authorId], kinds }, clock.now(), query.page);
    return { items: await this.postsService.presenter.presentPosts(page.items, query.viewerId, query.displayCurrency), nextCursor: page.nextCursor };
  }
}
