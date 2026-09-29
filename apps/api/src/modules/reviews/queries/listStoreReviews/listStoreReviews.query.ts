import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListStoreReviewsQuery extends Query<"reviews.listStoreReviews"> {
  public constructor(
    public readonly storeId: string,
    public readonly page: PageRequest,
  ) {
    super("reviews.listStoreReviews");
  }
}
