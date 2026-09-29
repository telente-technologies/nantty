import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { ChangeChannelSubscriptionHandler } from "./commands/changeChannelSubscription/changeChannelSubscription.handler.js";
import { ChangeGroupMembershipHandler } from "./commands/changeGroupMembership/changeGroupMembership.handler.js";
import { ChangeMessageReactionHandler } from "./commands/changeMessageReaction/changeMessageReaction.handler.js";
import { CreateChannelHandler } from "./commands/createChannel/createChannel.handler.js";
import { CreateGroupConversationHandler } from "./commands/createGroupConversation/createGroupConversation.handler.js";
import { IssueRealtimeTicketHandler } from "./commands/issueRealtimeTicket/issueRealtimeTicket.handler.js";
import { MarkConversationReadHandler } from "./commands/markConversationRead/markConversationRead.handler.js";
import { SendMessageHandler } from "./commands/sendMessage/sendMessage.handler.js";
import { StartConversationHandler } from "./commands/startConversation/startConversation.handler.js";
import { StartStoreConversationHandler } from "./commands/startStoreConversation/startStoreConversation.handler.js";
import { UpdateConversationSettingsHandler } from "./commands/updateConversationSettings/updateConversationSettings.handler.js";
import { GetConversationHandler } from "./queries/getConversation/getConversation.handler.js";
import { GetUnreadMessageCountHandler } from "./queries/getUnreadMessageCount/getUnreadMessageCount.handler.js";
import { GetVoiceNoteHandler } from "./queries/getVoiceNote/getVoiceNote.handler.js";
import { ListConversationMembersHandler } from "./queries/listConversationMembers/listConversationMembers.handler.js";
import { ListConversationsHandler } from "./queries/listConversations/listConversations.handler.js";
import { ListMessagesHandler } from "./queries/listMessages/listMessages.handler.js";
import { ListStoreConversationsHandler } from "./queries/listStoreConversations/listStoreConversations.handler.js";
import { SearchMessagesHandler } from "./queries/searchMessages/searchMessages.handler.js";
import { GroupMembershipService } from "./services/groupMembership.service.js";
import type { MessagesService } from "./services/messages.service.js";
import type { RealtimeTicketService } from "./services/realtimeTickets.service.js";

export class MessagesModule extends BaseModule {
  public readonly id = "messages";
  public readonly name = "messages";

  public constructor() {
    super({ version: "0.2.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("messages module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("messages module stopped");
  }
}

export function registerMessagesCommandAndQueryHandlers(
  commands: CommandBus,
  queries: QueryBus,
  messagesService: MessagesService,
  realtimeTickets: RealtimeTicketService,
): void {
  const membership = new GroupMembershipService(messagesService);
  registerCommandHandlers(commands, [
    new StartConversationHandler(messagesService),
    new StartStoreConversationHandler(messagesService),
    new SendMessageHandler(messagesService),
    new MarkConversationReadHandler(messagesService),
    new CreateGroupConversationHandler(messagesService),
    new CreateChannelHandler(messagesService),
    new UpdateConversationSettingsHandler(messagesService),
    new ChangeGroupMembershipHandler(messagesService, membership),
    new ChangeChannelSubscriptionHandler(messagesService),
    new ChangeMessageReactionHandler(messagesService),
    new IssueRealtimeTicketHandler(realtimeTickets),
  ]);
  registerQueryHandlers(queries, [
    new ListConversationsHandler(messagesService),
    new GetConversationHandler(messagesService),
    new ListMessagesHandler(messagesService),
    new GetUnreadMessageCountHandler(messagesService),
    new SearchMessagesHandler(messagesService),
    new ListConversationMembersHandler(messagesService, membership),
    new ListStoreConversationsHandler(messagesService),
    new GetVoiceNoteHandler(messagesService),
  ]);
}
