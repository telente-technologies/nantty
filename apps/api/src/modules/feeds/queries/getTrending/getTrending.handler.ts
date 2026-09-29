import { QueryHandler } from "@zudojs/cqrs";

import type { TrendingResultDto, TrendingService } from "../../services/trending.service.js";
import type { GetTrendingQuery } from "./getTrending.query.js";

export class GetTrendingHandler extends QueryHandler<GetTrendingQuery, TrendingResultDto> {
  public readonly queryType = "feeds.getTrending" as const;

  public constructor(private readonly trendingService: TrendingService) {
    super();
  }

  public execute(query: GetTrendingQuery): Promise<TrendingResultDto> {
    return this.trendingService.readTrending(query.principal.userId, query.trendingKind, query.country, query.limit, query.displayCurrency);
  }
}
