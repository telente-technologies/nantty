import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { CreateSupportTicketHandler } from "./commands/createSupportTicket/createSupportTicket.handler.js";
import { PostSupportTicketMessageHandler } from "./commands/postSupportTicketMessage/postSupportTicketMessage.handler.js";
import { SubmitContactRequestHandler } from "./commands/submitContactRequest/submitContactRequest.handler.js";
import { UpdateSupportTicketHandler } from "./commands/updateSupportTicket/updateSupportTicket.handler.js";
import { GetSupportTicketHandler } from "./queries/getSupportTicket/getSupportTicket.handler.js";
import { ListMySupportTicketsHandler } from "./queries/listMySupportTickets/listMySupportTickets.handler.js";
import { ListSupportTicketsHandler } from "./queries/listSupportTickets/listSupportTickets.handler.js";
import type { SupportService } from "./services/support.service.js";

export class SupportModule extends BaseModule {
  public readonly id = "support";
  public readonly name = "support";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("support module initialized");
  }
}

export function registerSupportCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, supportService: SupportService): void {
  registerCommandHandlers(commands, [
    new CreateSupportTicketHandler(supportService),
    new PostSupportTicketMessageHandler(supportService),
    new UpdateSupportTicketHandler(supportService),
    new SubmitContactRequestHandler(supportService),
  ]);
  registerQueryHandlers(queries, [
    new ListMySupportTicketsHandler(supportService),
    new GetSupportTicketHandler(supportService),
    new ListSupportTicketsHandler(supportService),
  ]);
}
