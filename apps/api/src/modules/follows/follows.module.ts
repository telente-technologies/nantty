import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { BlockUserHandler } from "./commands/blockUser/blockUser.handler.js";
import { FollowHandler } from "./commands/follow/follow.handler.js";
import { UnblockUserHandler } from "./commands/unblockUser/unblockUser.handler.js";
import { UnfollowHandler } from "./commands/unfollow/unfollow.handler.js";
import { GetFollowStatusHandler } from "./queries/getFollowStatus/getFollowStatus.handler.js";
import { ListBlockedUsersHandler } from "./queries/listBlockedUsers/listBlockedUsers.handler.js";
import { ListFollowersHandler } from "./queries/listFollowers/listFollowers.handler.js";
import { ListFollowingHandler } from "./queries/listFollowing/listFollowing.handler.js";
import { ListConnectionsHandler } from "./queries/listConnections/listConnections.handler.js";
import { SearchPeopleHandler } from "./queries/searchPeople/searchPeople.handler.js";
import { ConnectionsService } from "./services/connections.service.js";
import type { FollowsService } from "./services/follows.service.js";

export class FollowsModule extends BaseModule {
  public readonly id = "follows";
  public readonly name = "follows";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("follows module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("follows module stopped");
  }
}

export function registerFollowsCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, followsService: FollowsService): void {
  const connections = new ConnectionsService(followsService);
  registerCommandHandlers(commands, [
    new FollowHandler(followsService),
    new UnfollowHandler(followsService),
    new BlockUserHandler(followsService),
    new UnblockUserHandler(followsService),
  ]);
  registerQueryHandlers(queries, [
    new ListConnectionsHandler(connections),
    new SearchPeopleHandler(connections),
    new GetFollowStatusHandler(followsService),
    new ListFollowersHandler(followsService),
    new ListFollowingHandler(followsService),
    new ListBlockedUsersHandler(followsService),
  ]);
}
