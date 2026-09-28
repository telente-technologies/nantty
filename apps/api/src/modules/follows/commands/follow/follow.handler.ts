import { CommandHandler } from "@zudojs/cqrs";

import { NotificationRequestedEvent } from "../../../../events/notificationRequested.event.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import { FollowedEvent } from "../../events/followed.event.js";
import type { FollowsService } from "../../services/follows.service.js";
import type { FollowCommand } from "./follow.command.js";

export class FollowHandler extends CommandHandler<FollowCommand, void> {
  public readonly commandType = "follows.follow" as const;

  public constructor(private readonly followsService: FollowsService) {
    super();
  }

  public async execute(command: FollowCommand): Promise<void> {
    const { follows, events, clock } = this.followsService.dependencies;
    const followerId = command.principal.userId;
    const recipientId = await this.followsService.findRecipientAfterCheckingFollowTarget(followerId, command.targetType, command.targetId);
    const created = await follows.follow(followerId, command.targetType, command.targetId, clock.now());
    if (!created) return;
    await publishEvent(events, FollowedEvent, { followerId, targetType: command.targetType, targetId: command.targetId });
    if (recipientId === followerId) return;
    const follower = await this.followsService.findUserSummaryOrThrow(followerId);
    await publishEvent(events, NotificationRequestedEvent, {
      userId: recipientId,
      category: "social",
      title: "New follower",
      body: command.targetType === "store" ? `@${follower.username} started following your store.` : `@${follower.username} started following you.`,
      data: { type: "follow", followerId, targetType: command.targetType, targetId: command.targetId },
    });
  }
}
