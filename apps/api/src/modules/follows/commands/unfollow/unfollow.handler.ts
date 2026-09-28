import { CommandHandler } from "@zudojs/cqrs";

import { publishEvent } from "../../../../loaders/events.loader.js";
import { UnfollowedEvent } from "../../events/unfollowed.event.js";
import type { FollowsService } from "../../services/follows.service.js";
import type { UnfollowCommand } from "./unfollow.command.js";

export class UnfollowHandler extends CommandHandler<UnfollowCommand, void> {
  public readonly commandType = "follows.unfollow" as const;

  public constructor(private readonly followsService: FollowsService) {
    super();
  }

  public async execute(command: UnfollowCommand): Promise<void> {
    const { follows, events } = this.followsService.dependencies;
    const removed = await follows.unfollow(command.principal.userId, command.targetType, command.targetId);
    if (removed) {
      await publishEvent(events, UnfollowedEvent, { followerId: command.principal.userId, targetType: command.targetType, targetId: command.targetId });
    }
  }
}
