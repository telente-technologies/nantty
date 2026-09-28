import { CommandHandler } from "@zudojs/cqrs";

import type { FollowsService } from "../../services/follows.service.js";
import type { UnblockUserCommand } from "./unblockUser.command.js";

export class UnblockUserHandler extends CommandHandler<UnblockUserCommand, void> {
  public readonly commandType = "follows.unblockUser" as const;

  public constructor(private readonly followsService: FollowsService) {
    super();
  }

  public async execute(command: UnblockUserCommand): Promise<void> {
    await this.followsService.dependencies.blocks.unblock(command.principal.userId, command.blockedUserId);
  }
}
