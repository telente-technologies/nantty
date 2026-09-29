import { QueryHandler } from "@zudojs/cqrs";

import type { ConversationMemberDto } from "../../dtos/messages.dto.js";
import { isAdministratorRole } from "../../models/messages.model.js";
import type { GroupMembershipService } from "../../services/groupMembership.service.js";
import type { MessagesService } from "../../services/messages.service.js";
import type { ListConversationMembersQuery } from "./listConversationMembers.query.js";

export class ListConversationMembersHandler extends QueryHandler<ListConversationMembersQuery, readonly ConversationMemberDto[]> {
  public readonly queryType = "messages.listConversationMembers" as const;

  public constructor(private readonly messagesService: MessagesService, private readonly membership: GroupMembershipService) {
    super();
  }

  public async execute(query: ListConversationMembersQuery): Promise<readonly ConversationMemberDto[]> {
    const access = await this.messagesService.requireConversationAccess(query.conversationId, query.principal.userId);
    return this.membership.listMembers(access.conversation, isAdministratorRole(access.participant?.role));
  }
}
