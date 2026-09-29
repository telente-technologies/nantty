import { QueryHandler } from "@zudojs/cqrs";

import type { FeedPage, FeedsService } from "../../services/feeds.service.js";
import type { GetFollowingFeedQuery } from "./getFollowingFeed.query.js";

export class GetFollowingFeedHandler extends QueryHandler<GetFollowingFeedQuery, FeedPage> {
  public readonly queryType = "feeds.getFollowingFeed" as const;

  public constructor(private readonly feedsService: FeedsService) {
    super();
  }

  public execute(query: GetFollowingFeedQuery): Promise<FeedPage> {
    return this.feedsService.buildFollowingFeed(query.principal.userId, query.page, query.displayCurrency, query.country);
  }
}
