import { Query } from "@zudojs/cqrs";

export class ListMyCreatorSubscriptionsQuery extends Query<"creatorSubscriptions.listMyCreatorSubscriptions"> {
  public constructor(
    public readonly subscriberId: string,
  ) {
    super("creatorSubscriptions.listMyCreatorSubscriptions");
  }
}
