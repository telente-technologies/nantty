import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { FeedItemDto } from "../../dtos/feeds.dto.js";
import type { FeedsService } from "../../services/feeds.service.js";
import type { GetFollowingFeedQuery } from "./getFollowingFeed.query.js";

export class GetFollowingFeedHandler extends QueryHandler<GetFollowingFeedQuery, Page<FeedItemDto>> {
  public readonly queryType = "feeds.getFollowingFeed" as const;

  public constructor(private readonly feedsService: FeedsService) {
    super();
  }

  public execute(query: GetFollowingFeedQuery): Promise<Page<FeedItemDto>> {
    return this.feedsService.buildFollowingFeed(query.principal.userId, query.page, query.displayCurrency);
  }
}
