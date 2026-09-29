import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { FeedItemDto } from "../../dtos/feeds.dto.js";
import type { FeedsService } from "../../services/feeds.service.js";
import type { GetSuggestedClipsQuery } from "./getSuggestedClips.query.js";

export class GetSuggestedClipsHandler extends QueryHandler<GetSuggestedClipsQuery, Page<FeedItemDto>> {
  public readonly queryType = "feeds.getSuggestedClips" as const;

  public constructor(private readonly feedsService: FeedsService) {
    super();
  }

  public execute(query: GetSuggestedClipsQuery): Promise<Page<FeedItemDto>> {
    return this.feedsService.buildRankedFeed(query.principal.userId, ["clip"], query.topic, query.page, query.displayCurrency);
  }
}
