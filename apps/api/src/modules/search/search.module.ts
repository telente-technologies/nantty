import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { QueryBus } from "@zudojs/cqrs";

import { registerQueryHandlers } from "../../utils/cqrs.util.js";
import { SearchProductsHandler } from "./queries/searchProducts/searchProducts.handler.js";
import { SearchStoresHandler } from "./queries/searchStores/searchStores.handler.js";
import { SearchUsersHandler } from "./queries/searchUsers/searchUsers.handler.js";
import type { SearchService } from "./services/search.service.js";

export class SearchModule extends BaseModule {
  public readonly id = "search";
  public readonly name = "search";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("search module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("search module stopped");
  }
}

export function registerSearchQueryHandlers(queries: QueryBus, searchService: SearchService): void {
  registerQueryHandlers(queries, [
    new SearchProductsHandler(searchService),
    new SearchStoresHandler(searchService),
    new SearchUsersHandler(searchService),
  ]);
}
