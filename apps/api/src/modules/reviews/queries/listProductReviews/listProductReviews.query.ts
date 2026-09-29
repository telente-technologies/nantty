import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListProductReviewsQuery extends Query<"reviews.listProductReviews"> {
  public constructor(
    public readonly productId: string,
    public readonly page: PageRequest,
  ) {
    super("reviews.listProductReviews");
  }
}
