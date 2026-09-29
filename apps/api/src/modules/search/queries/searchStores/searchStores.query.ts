import { Query } from "@zudojs/cqrs";

export class SearchStoresQuery extends Query<"search.searchStores"> {
  public constructor(
    public readonly term: string,
    public readonly limit: number,
  ) {
    super("search.searchStores");
  }
}
