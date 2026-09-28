import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { CategoryRecord } from "../../models/categories.model.js";
import type { CategoriesService } from "../../services/categories.service.js";
import type { UpdateCategoryCommand } from "./updateCategory.command.js";

export class UpdateCategoryHandler extends CommandHandler<UpdateCategoryCommand, CategoryRecord> {
  public readonly commandType = "categories.updateCategory" as const;

  public constructor(private readonly categoriesService: CategoriesService) {
    super();
  }

  public async execute(command: UpdateCategoryCommand): Promise<CategoryRecord> {
    const updated = await this.categoriesService.categories.update(command.categoryId, { ...command.changes });
    if (updated === undefined) throw notFound("Category");
    await this.categoriesService.audit.record({
      actorId: command.principal.userId, action: "categories.updated", entityType: "category", entityId: updated.id,
    });
    return updated;
  }
}
