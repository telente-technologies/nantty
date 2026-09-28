import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { AddAddressHandler } from "./commands/addAddress/addAddress.handler.js";
import { DeactivateAccountHandler } from "./commands/deactivateAccount/deactivateAccount.handler.js";
import { RemoveAddressHandler } from "./commands/removeAddress/removeAddress.handler.js";
import { SaveTopicsHandler } from "./commands/saveTopics/saveTopics.handler.js";
import { UpdateAddressHandler } from "./commands/updateAddress/updateAddress.handler.js";
import { UpdatePreferencesHandler } from "./commands/updatePreferences/updatePreferences.handler.js";
import { UpdateProfileHandler } from "./commands/updateProfile/updateProfile.handler.js";
import { GetMeHandler } from "./queries/getMe/getMe.handler.js";
import { GetUserHandler } from "./queries/getUser/getUser.handler.js";
import { ListAddressesHandler } from "./queries/listAddresses/listAddresses.handler.js";
import { ListMyTopicsHandler } from "./queries/listMyTopics/listMyTopics.handler.js";
import { ListTopicsHandler } from "./queries/listTopics/listTopics.handler.js";
import type { UsersService } from "./services/users.service.js";

export class UsersModule extends BaseModule {
  public readonly id = "users";
  public readonly name = "users";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("users module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("users module stopped");
  }
}

export function registerUsersCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, usersService: UsersService): void {
  registerCommandHandlers(commands, [
    new UpdateProfileHandler(usersService),
    new UpdatePreferencesHandler(usersService),
    new SaveTopicsHandler(usersService),
    new DeactivateAccountHandler(usersService),
    new AddAddressHandler(usersService),
    new UpdateAddressHandler(usersService),
    new RemoveAddressHandler(usersService),
  ]);
  registerQueryHandlers(queries, [
    new GetMeHandler(usersService),
    new GetUserHandler(usersService),
    new ListAddressesHandler(usersService),
    new ListTopicsHandler(usersService),
    new ListMyTopicsHandler(usersService),
  ]);
}
