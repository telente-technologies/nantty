import { Query } from "@zudojs/cqrs";

export class SearchProductsQuery extends Query<"search.searchProducts"> {
  public constructor(
    public readonly term: string,
    public readonly limit: number,
  ) {
    super("search.searchProducts");
  }
}
