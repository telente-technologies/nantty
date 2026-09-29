import { Query } from "@zudojs/cqrs";

export class SearchPeopleQuery extends Query<"follows.searchPeople"> {
  public constructor(
    public readonly viewerId: string | undefined,
    public readonly term: string,
  ) {
    super("follows.searchPeople");
  }
}
