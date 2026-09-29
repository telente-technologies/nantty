import { Query } from "@zudojs/cqrs";

export class ListCreatorPlansQuery extends Query<"creatorSubscriptions.listCreatorPlans"> {
  public constructor(
    public readonly creatorId: string,
    public readonly includeInactive: boolean,
  ) {
    super("creatorSubscriptions.listCreatorPlans");
  }
}
