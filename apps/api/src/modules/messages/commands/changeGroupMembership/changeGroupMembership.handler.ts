import { CommandHandler } from "@zudojs/cqrs";

import type { ConversationMemberDto } from "../../dtos/messages.dto.js";
import type { GroupMembershipService } from "../../services/groupMembership.service.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { ChangeGroupMembershipCommand } from "./changeGroupMembership.command.js";

export class ChangeGroupMembershipHandler extends CommandHandler<ChangeGroupMembershipCommand, readonly ConversationMemberDto[] | undefined> {
  public readonly commandType = "messages.changeGroupMembership" as const;

  public constructor(private readonly messagesService: MessagesService, private readonly membership: GroupMembershipService) {
    super();
  }

  public async execute(command: ChangeGroupMembershipCommand): Promise<readonly ConversationMemberDto[] | undefined> {
    const userId = command.principal.userId;
    const { change } = command;
    if (change.type === "leave") {
      await this.membership.leave(await this.messagesService.requireConversationAccess(command.conversationId, userId));
      return undefined;
    }
    const access = await this.messagesService.requireGroupAdministrator(command.conversationId, userId);
    if (change.type === "add") return this.membership.addMembers(access, change.userIds);
    if (change.type === "remove") await this.membership.removeMember(access, change.userId);
    if (change.type === "promote") await this.membership.promoteToAdministrator(access, change.userId);
    if (change.type === "demote") await this.membership.demoteAdministrator(access, change.userId);
    return undefined;
  }
}
