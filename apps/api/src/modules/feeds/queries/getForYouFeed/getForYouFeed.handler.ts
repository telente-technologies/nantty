import { QueryHandler } from "@zudojs/cqrs";

import type { FeedPage, FeedsService } from "../../services/feeds.service.js";
import type { GetForYouFeedQuery } from "./getForYouFeed.query.js";

export class GetForYouFeedHandler extends QueryHandler<GetForYouFeedQuery, FeedPage> {
  public readonly queryType = "feeds.getForYouFeed" as const;

  public constructor(private readonly feedsService: FeedsService) {
    super();
  }

  public execute(query: GetForYouFeedQuery): Promise<FeedPage> {
    return this.feedsService.buildRankedFeed(query.principal.userId, ["post", "clip"], query.topic, query.page, query.displayCurrency, query.country);
  }
}
