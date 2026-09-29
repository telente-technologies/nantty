import { Query } from "@zudojs/cqrs";

export class GetMyCreatorApplicationQuery extends Query<"creators.getMyCreatorApplication"> {
  public constructor(
    public readonly userId: string,
  ) {
    super("creators.getMyCreatorApplication");
  }
}
