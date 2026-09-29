import { CommandHandler } from "@zudojs/cqrs";

import { forbidden, notFound, unprocessable } from "../../../../errors/domain.error.js";
import type { ConversationDto } from "../../dtos/messages.dto.js";
import { isAdministratorRole, type ConversationSettingsChanges } from "../../models/messages.model.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { UpdateConversationSettingsCommand } from "./updateConversationSettings.command.js";

function describeDisappearingSetting(seconds: number | null): string {
  if (seconds === null) return "turned off disappearing messages";
  if (seconds % 86_400 === 0) return `set messages to disappear after ${seconds / 86_400} day(s)`;
  if (seconds % 3_600 === 0) return `set messages to disappear after ${seconds / 3_600} hour(s)`;
  return `set messages to disappear after ${Math.round(seconds / 60)} minute(s)`;
}

export class UpdateConversationSettingsHandler extends CommandHandler<UpdateConversationSettingsCommand, ConversationDto> {
  public readonly commandType = "messages.updateConversationSettings" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(command: UpdateConversationSettingsCommand): Promise<ConversationDto> {
    const { conversations, userDirectory } = this.messagesService.dependencies;
    const userId = command.principal.userId;
    const { conversation, participant } = await this.messagesService.requireConversationAccess(command.conversationId, userId);
    const { name, photoMediaId, disappearingMessagesSeconds } = command.input;
    if (conversation.kind === "business") throw unprocessable("Store chats cannot be changed.");
    const changesIdentity = name !== undefined || photoMediaId !== undefined;
    if (changesIdentity && conversation.kind === "direct") throw unprocessable("Direct chats cannot be renamed.");
    if (conversation.kind !== "direct" && !isAdministratorRole(participant?.role)) throw forbidden("Only admins can change this conversation.");
    if (photoMediaId !== undefined) await this.messagesService.assertOwnedImageMedia(photoMediaId, userId);
    const changes: ConversationSettingsChanges = {
      ...(name === undefined ? {} : { title: name.trim() }),
      ...(photoMediaId === undefined ? {} : { photoMediaId }),
      ...(disappearingMessagesSeconds === undefined ? {} : { disappearingMessagesSeconds }),
    };
    const updated = (await conversations.updateSettings(conversation.id, changes)) ?? conversation;
    const [actor] = await userDirectory.findUserSummaries([userId]);
    const actorName = actor?.name || "Someone";
    if (name !== undefined && conversation.kind === "group") await this.messagesService.broadcaster.postSystemNotice(updated, `${actorName} renamed the group to "${name.trim()}"`);
    if (disappearingMessagesSeconds !== undefined && disappearingMessagesSeconds !== conversation.disappearingMessagesSeconds) {
      await this.messagesService.broadcaster.postSystemNotice(updated, `${actorName} ${describeDisappearingSetting(disappearingMessagesSeconds)}`);
    }
    await this.messagesService.broadcaster.announceConversationChanged(updated);
    const [summary] = await this.messagesService.conversationPresenter.presentConversations([updated], userId);
    if (summary === undefined) throw notFound("Conversation");
    return summary;
  }
}
