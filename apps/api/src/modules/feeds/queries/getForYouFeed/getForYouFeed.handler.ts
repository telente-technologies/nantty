import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { FeedItemDto } from "../../dtos/feeds.dto.js";
import type { FeedsService } from "../../services/feeds.service.js";
import type { GetForYouFeedQuery } from "./getForYouFeed.query.js";

export class GetForYouFeedHandler extends QueryHandler<GetForYouFeedQuery, Page<FeedItemDto>> {
  public readonly queryType = "feeds.getForYouFeed" as const;

  public constructor(private readonly feedsService: FeedsService) {
    super();
  }

  public execute(query: GetForYouFeedQuery): Promise<Page<FeedItemDto>> {
    return this.feedsService.buildRankedFeed(query.principal.userId, ["post", "clip"], query.topic, query.page, query.displayCurrency);
  }
}
