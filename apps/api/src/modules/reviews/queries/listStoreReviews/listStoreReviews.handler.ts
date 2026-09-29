import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { ReviewDto } from "../../dtos/reviews.dto.js";
import type { ReviewsService } from "../../services/reviews.service.js";
import type { ListStoreReviewsQuery } from "./listStoreReviews.query.js";

export class ListStoreReviewsHandler extends QueryHandler<ListStoreReviewsQuery, Page<ReviewDto>> {
  public readonly queryType = "reviews.listStoreReviews" as const;

  public constructor(private readonly reviewsService: ReviewsService) {
    super();
  }

  public async execute(query: ListStoreReviewsQuery): Promise<Page<ReviewDto>> {
    const page = await this.reviewsService.dependencies.reviews.list({ storeId: query.storeId }, query.page);
    return { items: await this.reviewsService.presentReviews(page.items), nextCursor: page.nextCursor };
  }
}
