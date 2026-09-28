import { Query } from "@zudojs/cqrs";

export class GetCategoryQuery extends Query<"categories.getCategory"> {
  public constructor(
    public readonly categoryId: string,
  ) {
    super("categories.getCategory");
  }
}
