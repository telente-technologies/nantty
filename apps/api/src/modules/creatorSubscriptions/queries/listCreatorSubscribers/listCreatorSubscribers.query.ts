import { Query } from "@zudojs/cqrs";

export class ListCreatorSubscribersQuery extends Query<"creatorSubscriptions.listCreatorSubscribers"> {
  public constructor(
    public readonly creatorId: string,
  ) {
    super("creatorSubscriptions.listCreatorSubscribers");
  }
}
