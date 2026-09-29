import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { LiveSessionDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { ListLiveSessionsQuery } from "./listLiveSessions.query.js";

export class ListLiveSessionsHandler extends QueryHandler<ListLiveSessionsQuery, Page<LiveSessionDto>> {
  public readonly queryType = "posts.listLiveSessions" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(query: ListLiveSessionsQuery): Promise<Page<LiveSessionDto>> {
    const page = await this.postsService.dependencies.liveSessions.listActive(query.page);
    return { items: await this.postsService.presenter.presentLiveSessions(page.items, query.displayCurrency), nextCursor: page.nextCursor };
  }
}
