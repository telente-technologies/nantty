import { Query } from "@zudojs/cqrs";

export class ListAllSubscriptionPlansQuery extends Query<"subscriptions.listAllSubscriptionPlans"> {
  public constructor() {
    super("subscriptions.listAllSubscriptionPlans");
  }
}
