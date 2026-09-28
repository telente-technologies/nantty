import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { CategoriesService } from "../../services/categories.service.js";
import type { DeleteCategoryCommand } from "./deleteCategory.command.js";

export class DeleteCategoryHandler extends CommandHandler<DeleteCategoryCommand, void> {
  public readonly commandType = "categories.deleteCategory" as const;

  public constructor(private readonly categoriesService: CategoriesService) {
    super();
  }

  public async execute(command: DeleteCategoryCommand): Promise<void> {
    if (!(await this.categoriesService.categories.delete(command.categoryId))) throw notFound("Category");
    await this.categoriesService.audit.record({
      actorId: command.principal.userId, action: "categories.deleted", entityType: "category", entityId: command.categoryId,
    });
  }
}
