import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { CommentDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { ListPostCommentsQuery } from "./listPostComments.query.js";

export class ListPostCommentsHandler extends QueryHandler<ListPostCommentsQuery, Page<CommentDto>> {
  public readonly queryType = "posts.listPostComments" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(query: ListPostCommentsQuery): Promise<Page<CommentDto>> {
    const post = await this.postsService.findVisiblePostOrThrow(query.postId, query.viewerId);
    const page = await this.postsService.dependencies.interactions.listComments(post.id, query.page);
    return { items: await this.postsService.presenter.presentComments(page.items), nextCursor: page.nextCursor };
  }
}
