import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { AddStoreMemberHandler } from "./commands/addStoreMember/addStoreMember.handler.js";
import { CreateStoreHandler } from "./commands/createStore/createStore.handler.js";
import { FeatureStoreHandler } from "./commands/featureStore/featureStore.handler.js";
import { RemoveStoreMemberHandler } from "./commands/removeStoreMember/removeStoreMember.handler.js";
import { ReviewSellerApplicationHandler } from "./commands/reviewSellerApplication/reviewSellerApplication.handler.js";
import { SubmitSellerApplicationHandler } from "./commands/submitSellerApplication/submitSellerApplication.handler.js";
import { SuspendStoreHandler } from "./commands/suspendStore/suspendStore.handler.js";
import { UpdateStoreHandler } from "./commands/updateStore/updateStore.handler.js";
import { GetStoreHandler } from "./queries/getStore/getStore.handler.js";
import { ListMySellerApplicationsHandler } from "./queries/listMySellerApplications/listMySellerApplications.handler.js";
import { ListMyStoresHandler } from "./queries/listMyStores/listMyStores.handler.js";
import { ListSellerApplicationsHandler } from "./queries/listSellerApplications/listSellerApplications.handler.js";
import { ListStoreMembersHandler } from "./queries/listStoreMembers/listStoreMembers.handler.js";
import { ListStoresHandler } from "./queries/listStores/listStores.handler.js";
import type { StoresService } from "./services/stores.service.js";

export class StoresModule extends BaseModule {
  public readonly id = "stores";
  public readonly name = "stores";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("stores module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("stores module stopped");
  }
}

export function registerStoresCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, storesService: StoresService): void {
  registerCommandHandlers(commands, [
    new SubmitSellerApplicationHandler(storesService),
    new ReviewSellerApplicationHandler(storesService),
    new CreateStoreHandler(storesService),
    new UpdateStoreHandler(storesService),
    new AddStoreMemberHandler(storesService),
    new RemoveStoreMemberHandler(storesService),
    new SuspendStoreHandler(storesService),
    new FeatureStoreHandler(storesService),
  ]);
  registerQueryHandlers(queries, [
    new GetStoreHandler(storesService),
    new ListStoresHandler(storesService),
    new ListMyStoresHandler(storesService),
    new ListStoreMembersHandler(storesService),
    new ListSellerApplicationsHandler(storesService),
    new ListMySellerApplicationsHandler(storesService),
  ]);
}
