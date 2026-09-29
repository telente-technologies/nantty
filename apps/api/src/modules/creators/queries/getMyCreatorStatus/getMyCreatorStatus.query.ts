import { Query } from "@zudojs/cqrs";

export class GetMyCreatorStatusQuery extends Query<"creators.getMyCreatorStatus"> {
  public constructor(
    public readonly userId: string,
  ) {
    super("creators.getMyCreatorStatus");
  }
}
