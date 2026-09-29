import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { LiveCommentDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { ListLiveCommentsQuery } from "./listLiveComments.query.js";

export class ListLiveCommentsHandler extends QueryHandler<ListLiveCommentsQuery, Page<LiveCommentDto>> {
  public readonly queryType = "posts.listLiveComments" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(query: ListLiveCommentsQuery): Promise<Page<LiveCommentDto>> {
    const session = await this.postsService.findLiveSessionOrThrow(query.sessionId);
    const page = await this.postsService.dependencies.liveSessions.listComments(session.id, query.page);
    return { items: await this.postsService.presenter.presentLiveComments(page.items), nextCursor: page.nextCursor };
  }
}
