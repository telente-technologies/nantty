import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { MarkConversationReadHandler } from "./commands/markConversationRead/markConversationRead.handler.js";
import { SendMessageHandler } from "./commands/sendMessage/sendMessage.handler.js";
import { StartConversationHandler } from "./commands/startConversation/startConversation.handler.js";
import { GetConversationHandler } from "./queries/getConversation/getConversation.handler.js";
import { GetUnreadMessageCountHandler } from "./queries/getUnreadMessageCount/getUnreadMessageCount.handler.js";
import { ListConversationsHandler } from "./queries/listConversations/listConversations.handler.js";
import { ListMessagesHandler } from "./queries/listMessages/listMessages.handler.js";
import { SearchMessagesHandler } from "./queries/searchMessages/searchMessages.handler.js";
import type { MessagesService } from "./services/messages.service.js";

export class MessagesModule extends BaseModule {
  public readonly id = "messages";
  public readonly name = "messages";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("messages module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("messages module stopped");
  }
}

export function registerMessagesCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, messagesService: MessagesService): void {
  registerCommandHandlers(commands, [
    new StartConversationHandler(messagesService),
    new SendMessageHandler(messagesService),
    new MarkConversationReadHandler(messagesService),
  ]);
  registerQueryHandlers(queries, [
    new ListConversationsHandler(messagesService),
    new GetConversationHandler(messagesService),
    new ListMessagesHandler(messagesService),
    new GetUnreadMessageCountHandler(messagesService),
    new SearchMessagesHandler(messagesService),
  ]);
}
