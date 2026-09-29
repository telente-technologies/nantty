import { Query } from "@zudojs/cqrs";

export class SearchUsersQuery extends Query<"search.searchUsers"> {
  public constructor(
    public readonly term: string,
    public readonly limit: number,
  ) {
    super("search.searchUsers");
  }
}
