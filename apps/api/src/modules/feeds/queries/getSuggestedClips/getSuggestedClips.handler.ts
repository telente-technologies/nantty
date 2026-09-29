import { QueryHandler } from "@zudojs/cqrs";

import type { FeedPage, FeedsService } from "../../services/feeds.service.js";
import type { GetSuggestedClipsQuery } from "./getSuggestedClips.query.js";

export class GetSuggestedClipsHandler extends QueryHandler<GetSuggestedClipsQuery, FeedPage> {
  public readonly queryType = "feeds.getSuggestedClips" as const;

  public constructor(private readonly feedsService: FeedsService) {
    super();
  }

  public execute(query: GetSuggestedClipsQuery): Promise<FeedPage> {
    return this.feedsService.buildRankedFeed(query.principal.userId, ["clip"], query.topic, query.page, query.displayCurrency, query.country);
  }
}
