import { QueryHandler } from "@zudojs/cqrs";

import type { CategoryRecord } from "../../models/categories.model.js";
import type { CategoriesService } from "../../services/categories.service.js";
import type { ListCategoriesQuery } from "./listCategories.query.js";

export class ListCategoriesHandler extends QueryHandler<ListCategoriesQuery, readonly CategoryRecord[]> {
  public readonly queryType = "categories.listCategories" as const;

  public constructor(private readonly categoriesService: CategoriesService) {
    super();
  }

  public execute(_query: ListCategoriesQuery): Promise<readonly CategoryRecord[]> {
    return this.categoriesService.categories.listAll();
  }
}
