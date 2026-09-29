import { QueryHandler } from "@zudojs/cqrs";

import type { RatingSummary } from "../../models/reviews.model.js";
import type { ReviewsService } from "../../services/reviews.service.js";
import type { GetRatingSummaryQuery } from "./getRatingSummary.query.js";

export class GetRatingSummaryHandler extends QueryHandler<GetRatingSummaryQuery, RatingSummary> {
  public readonly queryType = "reviews.getRatingSummary" as const;

  public constructor(private readonly reviewsService: ReviewsService) {
    super();
  }

  public execute(query: GetRatingSummaryQuery): Promise<RatingSummary> {
    return this.reviewsService.dependencies.reviews.summarize({ productId: query.productId });
  }
}
