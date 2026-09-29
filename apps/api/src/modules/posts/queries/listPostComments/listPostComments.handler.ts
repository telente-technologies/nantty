import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { TopLevelCommentDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { ListPostCommentsQuery } from "./listPostComments.query.js";

export class ListPostCommentsHandler extends QueryHandler<ListPostCommentsQuery, Page<TopLevelCommentDto>> {
  public readonly queryType = "posts.listPostComments" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(query: ListPostCommentsQuery): Promise<Page<TopLevelCommentDto>> {
    const post = await this.postsService.findVisiblePostOrThrow(query.postId, query.viewerId);
    const page = await this.postsService.dependencies.interactions.listTopLevelComments(post.id, query.page);
    return { data: await this.postsService.commentPresenter.presentTopLevelComments(page.data, query.viewerId), nextCursor: page.nextCursor };
  }
}
