import { Query } from "@zudojs/cqrs";

export class GetRatingSummaryQuery extends Query<"reviews.getRatingSummary"> {
  public constructor(
    public readonly productId: string,
  ) {
    super("reviews.getRatingSummary");
  }
}
