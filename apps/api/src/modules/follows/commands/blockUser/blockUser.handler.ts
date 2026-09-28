import { CommandHandler } from "@zudojs/cqrs";

import { unprocessable } from "../../../../errors/domain.error.js";
import type { FollowsService } from "../../services/follows.service.js";
import type { BlockUserCommand } from "./blockUser.command.js";

export class BlockUserHandler extends CommandHandler<BlockUserCommand, void> {
  public readonly commandType = "follows.blockUser" as const;

  public constructor(private readonly followsService: FollowsService) {
    super();
  }

  public async execute(command: BlockUserCommand): Promise<void> {
    const { blocks, follows, clock } = this.followsService.dependencies;
    const blockerId = command.principal.userId;
    if (blockerId === command.blockedUserId) throw unprocessable("You cannot block yourself.");
    await this.followsService.findUserSummaryOrThrow(command.blockedUserId);
    await blocks.block(blockerId, command.blockedUserId, clock.now());
    await follows.removeUserFollowsBetween(blockerId, command.blockedUserId);
  }
}
