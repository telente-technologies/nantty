import { Query } from "@zudojs/cqrs";

export class GetSubscriptionQuery extends Query<"subscriptions.getSubscription"> {
  public constructor(
    public readonly profileId: string,
  ) {
    super("subscriptions.getSubscription");
  }
}
