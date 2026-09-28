import { QueryHandler } from "@zudojs/cqrs";

import type { CategoryRecord } from "../../models/categories.model.js";
import type { CategoriesService } from "../../services/categories.service.js";
import type { GetCategoryQuery } from "./getCategory.query.js";

export class GetCategoryHandler extends QueryHandler<GetCategoryQuery, CategoryRecord> {
  public readonly queryType = "categories.getCategory" as const;

  public constructor(private readonly categoriesService: CategoriesService) {
    super();
  }

  public execute(query: GetCategoryQuery): Promise<CategoryRecord> {
    return this.categoriesService.findCategoryOrThrow(query.categoryId);
  }
}
