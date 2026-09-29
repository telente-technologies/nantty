import { CommandHandler } from "@zudojs/cqrs";

import { forbidden, notFound, unprocessable } from "../../../../errors/domain.error.js";
import type { ConversationDto } from "../../dtos/messages.dto.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { CreateGroupConversationCommand } from "./createGroupConversation.command.js";

export class CreateGroupConversationHandler extends CommandHandler<CreateGroupConversationCommand, ConversationDto> {
  public readonly commandType = "messages.createGroupConversation" as const;

  public constructor(private readonly messagesService: MessagesService) {
    super();
  }

  public async execute(command: CreateGroupConversationCommand): Promise<ConversationDto> {
    const { conversations, userDirectory, socialGraph, clock, settings } = this.messagesService.dependencies;
    const ownerId = command.principal.userId;
    const memberIds = [...new Set(command.input.memberIds)].filter((memberId) => memberId !== ownerId);
    if (memberIds.length === 0) throw unprocessable("Add at least one other person to the group.");
    if (memberIds.length + 1 > settings.maximumGroupMembers) throw unprocessable(`A group can have at most ${settings.maximumGroupMembers} members.`);
    const members = await userDirectory.findUserSummaries(memberIds);
    if (members.length !== memberIds.length) throw notFound("User");
    for (const memberId of memberIds) {
      if (await socialGraph.isBlockedEitherWay(ownerId, memberId)) throw forbidden("You cannot add someone you have blocked or who blocked you.");
    }
    if (command.input.photoMediaId !== undefined) await this.messagesService.assertOwnedImageMedia(command.input.photoMediaId, ownerId);
    const conversation = await conversations.createConversation(
      {
        kind: "group",
        pairKey: null,
        title: command.input.name.trim(),
        description: "",
        photoMediaId: command.input.photoMediaId ?? null,
        ownerId,
        storeId: null,
        disappearingMessagesSeconds: null,
      },
      [{ userId: ownerId, role: "owner" }, ...memberIds.map((userId) => ({ userId, role: "member" as const }))],
      clock.now(),
    );
    const [owner] = await userDirectory.findUserSummaries([ownerId]);
    await this.messagesService.broadcaster.postSystemNotice(conversation, `${owner?.name || "Someone"} created the group`);
    const refreshed = (await conversations.findById(conversation.id)) ?? conversation;
    const [summary] = await this.messagesService.conversationPresenter.presentConversations([refreshed], ownerId);
    if (summary === undefined) throw notFound("Conversation");
    return summary;
  }
}
