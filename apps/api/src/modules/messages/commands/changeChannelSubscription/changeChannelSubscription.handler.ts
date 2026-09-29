import { CommandHandler } from "@zudojs/cqrs";

import { notFound, unprocessable } from "../../../../errors/domain.error.js";
import type { ConversationDto } from "../../dtos/messages.dto.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { ChangeChannelSubscriptionCommand } from "./changeChannelSubscription.command.js";

export class ChangeChannelSubscriptionHandler extends CommandHandler<ChangeChannelSubscriptionCommand, ConversationDto | undefined> {
  public readonly commandType = "messages.changeChannelSubscription" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(command: ChangeChannelSubscriptionCommand): Promise<ConversationDto | undefined> {
    const { conversations, clock } = this.messagesService.dependencies;
    const userId = command.principal.userId;
    const channel = await conversations.findById(command.channelId);
    if (channel === undefined || channel.kind !== "channel") throw notFound("Channel");
    const membership = await conversations.findParticipant(channel.id, userId);
    if (!command.subscribe) {
      if (membership?.role === "owner") throw unprocessable("The channel owner cannot unsubscribe.");
      if (membership !== undefined) await conversations.removeParticipant(channel.id, userId);
      return undefined;
    }
    if (membership === undefined) await conversations.addParticipants(channel.id, [{ userId, role: "subscriber" }], clock.now());
    const refreshed = (await conversations.findById(channel.id)) ?? channel;
    const [summary] = await this.messagesService.conversationPresenter.presentConversations([refreshed], userId);
    return summary;
  }
}
