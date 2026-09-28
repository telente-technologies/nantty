import { Query } from "@zudojs/cqrs";

export class ListCategoriesQuery extends Query<"categories.listCategories"> {
  public constructor() {
    super("categories.listCategories");
  }
}
