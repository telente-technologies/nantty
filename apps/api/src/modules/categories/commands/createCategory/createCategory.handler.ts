import { CommandHandler } from "@zudojs/cqrs";

import { createSlugFromText } from "../../../../utils/slug.util.js";
import type { CategoryRecord } from "../../models/categories.model.js";
import type { CategoriesService } from "../../services/categories.service.js";
import type { CreateCategoryCommand } from "./createCategory.command.js";

export class CreateCategoryHandler extends CommandHandler<CreateCategoryCommand, CategoryRecord> {
  public readonly commandType = "categories.createCategory" as const;

  public constructor(private readonly categoriesService: CategoriesService) {
    super();
  }

  public async execute(command: CreateCategoryCommand): Promise<CategoryRecord> {
    const { input } = command;
    const category = await this.categoriesService.categories.create({
      name: input.name.trim(),
      slug: input.slug ?? createSlugFromText(input.name),
      parentId: input.parentId ?? null,
      imageUrl: input.imageUrl ?? null,
      sortOrder: input.sortOrder ?? 0,
    });
    await this.categoriesService.audit.record({
      actorId: command.principal.userId, action: "categories.created", entityType: "category", entityId: category.id,
    });
    return category;
  }
}
