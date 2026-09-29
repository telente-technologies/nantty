import { Query } from "@zudojs/cqrs";

export class ListCreatorAffiliationsQuery extends Query<"creators.listCreatorAffiliations"> {
  public constructor(
    public readonly userId: string,
  ) {
    super("creators.listCreatorAffiliations");
  }
}
