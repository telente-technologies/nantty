import { Query } from "@zudojs/cqrs";

export class GetCreatorEligibilityQuery extends Query<"creators.getCreatorEligibility"> {
  public constructor(
    public readonly userId: string,
  ) {
    super("creators.getCreatorEligibility");
  }
}
