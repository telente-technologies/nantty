import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { ReviewDto } from "../../dtos/reviews.dto.js";
import type { ReviewsService } from "../../services/reviews.service.js";
import type { ListProductReviewsQuery } from "./listProductReviews.query.js";

export class ListProductReviewsHandler extends QueryHandler<ListProductReviewsQuery, Page<ReviewDto>> {
  public readonly queryType = "reviews.listProductReviews" as const;

  public constructor(private readonly reviewsService: ReviewsService) {
    super();
  }

  public async execute(query: ListProductReviewsQuery): Promise<Page<ReviewDto>> {
    const page = await this.reviewsService.dependencies.reviews.list({ productId: query.productId }, query.page);
    return { items: await this.reviewsService.presentReviews(page.items), nextCursor: page.nextCursor };
  }
}
