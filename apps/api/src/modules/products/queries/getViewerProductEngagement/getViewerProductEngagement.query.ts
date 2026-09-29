import { Query } from "@zudojs/cqrs";

export class GetViewerProductEngagementQuery extends Query<"products.getViewerProductEngagement"> {
  public constructor(
    public readonly viewerId: string | undefined,
    public readonly productIds: readonly string[],
  ) {
    super("products.getViewerProductEngagement");
  }
}
