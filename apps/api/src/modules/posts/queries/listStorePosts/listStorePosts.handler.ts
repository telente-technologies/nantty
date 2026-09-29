import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { PostDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { ListStorePostsQuery } from "./listStorePosts.query.js";

export class ListStorePostsHandler extends QueryHandler<
  ListStorePostsQuery,
  Page<PostDto>
> {
  public readonly queryType = "posts.listStorePosts" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(query: ListStorePostsQuery): Promise<Page<PostDto>> {
    const { posts, clock, socialGraph } = this.postsService.dependencies;
    const blocked =
      query.viewerId === undefined
        ? []
        : await socialGraph.listUserIdsBlockedEitherWay(query.viewerId);
    const page = await posts.listVisible(
      {
        storeIds: [query.storeId],
        kinds: ["post", "clip"],
        excludeAuthorIds: blocked,
      },
      clock.now(),
      query.page,
    );
    return {
      items: await this.postsService.presenter.presentPosts(
        page.items,
        query.viewerId,
        query.displayCurrency,
      ),
      nextCursor: page.nextCursor,
    };
  }
}
