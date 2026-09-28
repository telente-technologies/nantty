import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { CreateCategoryHandler } from "./commands/createCategory/createCategory.handler.js";
import { DeleteCategoryHandler } from "./commands/deleteCategory/deleteCategory.handler.js";
import { UpdateCategoryHandler } from "./commands/updateCategory/updateCategory.handler.js";
import { GetCategoryHandler } from "./queries/getCategory/getCategory.handler.js";
import { ListCategoriesHandler } from "./queries/listCategories/listCategories.handler.js";
import type { CategoriesService } from "./services/categories.service.js";

export class CategoriesModule extends BaseModule {
  public readonly id = "categories";
  public readonly name = "categories";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("categories module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("categories module stopped");
  }
}

export function registerCategoriesCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, categoriesService: CategoriesService): void {
  registerCommandHandlers(commands, [
    new CreateCategoryHandler(categoriesService),
    new UpdateCategoryHandler(categoriesService),
    new DeleteCategoryHandler(categoriesService),
  ]);
  registerQueryHandlers(queries, [new GetCategoryHandler(categoriesService), new ListCategoriesHandler(categoriesService)]);
}
