import { Query } from "@zudojs/cqrs";

export class GetCreatorSubscriptionQuery extends Query<"creatorSubscriptions.getCreatorSubscription"> {
  public constructor(
    public readonly userId: string,
    public readonly subscriptionId: string,
  ) {
    super("creatorSubscriptions.getCreatorSubscription");
  }
}
